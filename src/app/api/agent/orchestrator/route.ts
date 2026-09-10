// LEGION Phase 04 — Mission Runtime API & NDJSON Streaming Endpoint
// Server-only endpoint that executes LegionOrchestrator and streams real-time telemetry to the client

import { NextRequest, NextResponse } from "next/server";
import { getSandboxProvider, getLLMProvider } from "@/lib/providers";
import { CommanderAgent } from "@/lib/agent/commander-agent";
import { ArchitectAgent } from "@/lib/agent/architect-agent";
import { BuilderAgent } from "@/lib/agent/builder-agent";
import { SentinelAgent } from "@/lib/agent/sentinel-agent";
import { LegionOrchestrator } from "@/lib/agent/orchestrator";
import { legionEventBus } from "@/lib/events/bus";
import { MissionStreamEventEnvelope } from "@/types/stream";
import { sanitizeValue } from "@/lib/memory/sanitizer";

export const dynamic = "force-dynamic";

const MAX_MISSION_LENGTH = 10_000;
const MAX_TIMEOUT_MS = 600_000; // 10 minutes

export async function POST(req: NextRequest) {
  // 1. Content-Type check (if provided)
  const contentType = req.headers.get("content-type");
  if (contentType && !contentType.includes("application/json")) {
    return NextResponse.json(
      { error: "Invalid Content-Type. Expected application/json." },
      { status: 415 }
    );
  }

  // 2. Parse & Validate JSON payload
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Malformed JSON body." },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Request body must be a JSON object." },
      { status: 400 }
    );
  }

  const rawMission = body.mission || body.missionPrompt;
  if (typeof rawMission !== "string" || rawMission.trim().length === 0) {
    return NextResponse.json(
      { error: "The 'mission' field is required and cannot be empty." },
      { status: 400 }
    );
  }

  const missionPrompt = rawMission.trim();
  if (missionPrompt.length > MAX_MISSION_LENGTH) {
    return NextResponse.json(
      { error: `Mission prompt exceeds maximum allowed length (${MAX_MISSION_LENGTH} characters).` },
      { status: 400 }
    );
  }

  const missionId =
    typeof body.missionId === "string" && body.missionId.trim().length > 0
      ? body.missionId.trim()
      : `mission-${Date.now()}`;

  const projectContext = typeof body.projectContext === "string" ? body.projectContext : undefined;

  const timeoutMs =
    typeof body.timeoutMs === "number" && body.timeoutMs > 0 && body.timeoutMs <= MAX_TIMEOUT_MS
      ? body.timeoutMs
      : 300_000;

  const maxAttemptsPerTask =
    typeof body.maxAttemptsPerTask === "number" &&
    body.maxAttemptsPerTask >= 1 &&
    body.maxAttemptsPerTask <= 10
      ? Math.floor(body.maxAttemptsPerTask)
      : 3;

  const maxConcurrentTasks =
    typeof body.maxConcurrentTasks === "number" &&
    body.maxConcurrentTasks >= 1 &&
    body.maxConcurrentTasks <= 8
      ? Math.floor(body.maxConcurrentTasks)
      : 2;

  const failurePolicy =
    body.failurePolicy === "CONTINUE_INDEPENDENT" ? "CONTINUE_INDEPENDENT" : "FAIL_FAST";

  // 3. Setup Server-Side Providers & Isolated Agents
  const sandboxProvider = getSandboxProvider();
  const llmProvider = getLLMProvider();

  const commander = new CommanderAgent({ llm: llmProvider });
  const architect = new ArchitectAgent({ llm: llmProvider });
  const builder = new BuilderAgent({ sandbox: sandboxProvider, llm: llmProvider, defaultTimeoutMs: timeoutMs });
  const sentinel = new SentinelAgent({ llm: llmProvider });

  const orchestrator = new LegionOrchestrator({
    commander,
    architect,
    builder,
    sentinel,
    sandboxProvider,
    maxAttemptsPerTask,
    maxConcurrentTasks,
    failurePolicy,
    defaultTimeoutMs: timeoutMs,
  });

  // 4. Setup NDJSON Streaming Web Stream
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  let isStreamClosed = false;

  const sendEnvelope = async (envelope: MissionStreamEventEnvelope) => {
    if (isStreamClosed) return;
    try {
      const sanitized = sanitizeValue(envelope);
      const line = JSON.stringify(sanitized) + "\n";
      await writer.write(encoder.encode(line));
    } catch {
      isStreamClosed = true;
    }
  };

  const abortController = new AbortController();

  // Forward client request cancellation to abortController
  if (req.signal) {
    if (req.signal.aborted) {
      abortController.abort();
    } else {
      req.signal.addEventListener("abort", () => {
        abortController.abort();
      });
    }
  }

  // 5. Asynchronously Run Pipeline with Scoped Event Bus Isolation
  (async () => {
    let sandboxId = "";
    let seq = 0;

    let terminalEventEmitted = false;

    // Isolated Event Bus listener scoped strictly to this missionId
    const unsubscribeBus = legionEventBus.subscribe(
      "*",
      (evt) => {
        seq++;
        if (evt.type === "MISSION_COMPLETED" || evt.type === "MISSION_FAILED") {
          terminalEventEmitted = true;
        }
        sendEnvelope({
          id: evt.id,
          type: evt.type,
          missionId,
          taskId: "taskId" in evt ? String(evt.taskId) : undefined,
          agentRole: "role" in evt ? String(evt.role) : "agentRole" in evt ? String(evt.agentRole) : undefined,
          slotId: "slotId" in evt ? (evt as { slotId?: number }).slotId : undefined,
          activeTaskCount: "activeTaskCount" in evt ? (evt as { activeTaskCount?: number }).activeTaskCount : undefined,
          concurrencyLimit: "concurrencyLimit" in evt ? (evt as { concurrencyLimit?: number }).concurrencyLimit : undefined,
          timestamp: evt.timestamp || new Date().toISOString(),
          seq,
          message: "message" in evt ? String(evt.message) : undefined,
          data: evt as unknown as Record<string, unknown>,
        });
      },
      { missionId }
    );

    let orchestratorResult: unknown = undefined;

    try {
      if (abortController.signal.aborted) {
        throw new Error("EXECUTION_CANCELLED");
      }

      // Announce Sandbox Allocation
      seq++;
      await sendEnvelope({
        id: `evt-sbx-alloc-${Date.now()}`,
        type: "SANDBOX_CREATED",
        missionId,
        timestamp: new Date().toISOString(),
        seq,
        message: `Allocating isolated micro-VM sandbox (${sandboxProvider.name})...`,
      });

      const sandboxInstance = await sandboxProvider.create();
      sandboxId = sandboxInstance.id;

      seq++;
      await sendEnvelope({
        id: `evt-sbx-ready-${Date.now()}`,
        type: "SANDBOX_READY",
        missionId,
        timestamp: new Date().toISOString(),
        seq,
        message: `Sandbox container "${sandboxId}" is active and isolated.`,
      });

      // Execute Orchestrator (emits MISSION_COMPLETED or MISSION_FAILED via event bus)
      // Enforce zero-bypass real execution by default on API endpoint
      const requireRealExecution = body.allowMock === true && process.env.NODE_ENV === "test"
        ? false
        : true;

      orchestratorResult = await orchestrator.run({
        missionId,
        missionPrompt,
        projectContext,
        sandboxId,
        maxAttemptsPerTask,
        timeoutMs,
        requireRealExecution,
        signal: abortController.signal,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (!terminalEventEmitted) {
        terminalEventEmitted = true;
        seq++;
        await sendEnvelope({
          id: `evt-err-${Date.now()}`,
          type: "MISSION_FAILED",
          missionId,
          timestamp: new Date().toISOString(),
          seq,
          message: `Orchestrator runtime error: ${errorMsg}`,
          error: errorMsg,
        });
      }
    } finally {
      // 1. Safely destroy sandbox container BEFORE closing stream
      if (sandboxId) {
        try {
          await sandboxProvider.destroy(sandboxId);
          seq++;
          await sendEnvelope({
            id: `evt-sbx-destroyed-${Date.now()}`,
            type: "SANDBOX_DESTROYED",
            missionId,
            timestamp: new Date().toISOString(),
            seq,
            message: `Sandbox container "${sandboxId}" safely destroyed.`,
          });
        } catch (destroyErr) {
          const destroyMsg = `SANDBOX_DESTROY_FAILED: Sandbox container "${sandboxId}" cleanup failed: ${destroyErr instanceof Error ? destroyErr.message : String(destroyErr)}`;
          seq++;
          await sendEnvelope({
            id: `evt-sbx-err-${Date.now()}`,
            type: "SANDBOX_ERROR",
            missionId,
            timestamp: new Date().toISOString(),
            seq,
            message: destroyMsg,
            error: destroyMsg,
          });
        }
      }

      // 2. Send STREAM_END as the absolute final envelope
      seq++;
      await sendEnvelope({
        type: "STREAM_END",
        missionId,
        timestamp: new Date().toISOString(),
        seq,
        result: orchestratorResult as any,
      });

      // 3. Unsubscribe from global event bus
      unsubscribeBus();

      // 4. Close web stream cleanly
      if (!isStreamClosed) {
        isStreamClosed = true;
        try {
          await writer.close();
        } catch {
          // Already closed
        }
      }
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
