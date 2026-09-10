// Real Builder Agent API Route — Streaming NDJSON Execution for LEGION

import { NextRequest } from "next/server";
import { getSandboxProvider, getLLMProvider } from "@/lib/providers";
import { BuilderAgent } from "@/lib/agent/builder-agent";
import { legionEventBus } from "@/lib/events/bus";
import { sanitizeValue } from "@/lib/memory/sanitizer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { missionId?: string; taskPrompt?: string; timeoutMs?: number } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const missionId = body.missionId || "mission-001";
  const taskPrompt =
    body.taskPrompt || "Create a file hello.ts that prints LEGION ONLINE, execute it, and verify it runs successfully.";
  const timeoutMs = typeof body.timeoutMs === "number" ? body.timeoutMs : 120_000;

  const sandboxProvider = getSandboxProvider();
  const llmProvider = getLLMProvider();

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendEvent = async (event: unknown) => {
    try {
      const sanitized = sanitizeValue(event);
      const line = JSON.stringify(sanitized) + "\n";
      await writer.write(encoder.encode(line));
    } catch {
      // Client disconnected
    }
  };

  // Launch background execution pipeline
  (async () => {
    let sandboxId = "";
    try {
      // 1. Announce Sandbox creation
      await sendEvent({
        id: `evt-sbx-start-${Date.now()}`,
        missionId,
        timestamp: new Date().toISOString(),
        seq: 1,
        type: "SANDBOX_CREATED",
        sandboxId: "allocating",
        provider: sandboxProvider.name,
        message: `Allocating sandbox container (${sandboxProvider.name})...`,
      });

      const instance = await sandboxProvider.create();
      sandboxId = instance.id;

      await sendEvent({
        id: `evt-sbx-ready-${Date.now()}`,
        missionId,
        timestamp: new Date().toISOString(),
        seq: 2,
        type: "SANDBOX_READY",
        sandboxId,
        provider: sandboxProvider.name,
        message: `Sandbox ${sandboxId} is active and ready for Builder.`,
      });

      // 2. Instantiate and run Builder Agent
      const builder = new BuilderAgent({
        sandbox: sandboxProvider,
        llm: llmProvider,
        defaultTimeoutMs: timeoutMs,
      });

      let seqCount = 10;
      const result = await builder.run({
        missionId,
        taskPrompt,
        sandboxId,
        timeoutMs,
        onEvent: (evt) => {
          seqCount++;
          sendEvent({
            ...evt,
            seq: seqCount,
          });
        },
      });

      // 3. Send final summary event
      await sendEvent({
        id: `evt-builder-summary-${Date.now()}`,
        missionId,
        timestamp: new Date().toISOString(),
        seq: seqCount + 1,
        type: "TERMINAL_OUTPUT",
        stream: result.status === "SUCCESS" ? "SUCCESS" : "WARNING",
        text: `\n[BUILDER SUMMARY] Status: ${result.status} | Iterations: ${result.iterations} | Tokens: ${result.totalTokens.total} | Duration: ${result.durationMs}ms\n`,
      });

      await sendEvent({
        type: "STREAM_END",
        result,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await sendEvent({
        id: `evt-err-${Date.now()}`,
        missionId,
        timestamp: new Date().toISOString(),
        seq: 999,
        type: "AGENT_FAILED",
        role: "BUILDER",
        status: "FAILED",
        message: `Builder execution failed: ${errorMsg}`,
      });
      await sendEvent({
        type: "STREAM_END",
        error: errorMsg,
      });
    } finally {
      if (sandboxId) {
        try {
          await sandboxProvider.destroy(sandboxId);
          await sendEvent({
            id: `evt-sbx-destroyed-${Date.now()}`,
            missionId,
            timestamp: new Date().toISOString(),
            seq: 1000,
            type: "SANDBOX_DESTROYED",
            sandboxId,
            provider: sandboxProvider.name,
            message: `Sandbox ${sandboxId} safely destroyed.`,
          });
        } catch {
          // Teardown errors ignored
        }
      }
      try {
        await writer.close();
      } catch {
        // Stream closed
      }
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
