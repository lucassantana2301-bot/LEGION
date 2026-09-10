import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";
import { legionEventBus } from "@/lib/events/bus";

describe("POST /api/agent/orchestrator (NDJSON Streaming Runtime API)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  async function readStreamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
    const reader = stream.getReader();
    const decoder = new TextDecoder("utf-8");
    let result = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }
    return result;
  }

  it("rejects request with malformed JSON body", async () => {
    const req = new NextRequest("http://localhost:3000/api/agent/orchestrator", {
      method: "POST",
      body: "not-json",
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Malformed JSON body");
  });

  it("rejects request when mission field is missing or empty", async () => {
    const req = new NextRequest("http://localhost:3000/api/agent/orchestrator", {
      method: "POST",
      body: JSON.stringify({ mission: "   " }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("cannot be empty");
  });

  it("rejects request with excessively large mission prompt", async () => {
    const hugePrompt = "a".repeat(10_001);
    const req = new NextRequest("http://localhost:3000/api/agent/orchestrator", {
      method: "POST",
      body: JSON.stringify({ mission: hugePrompt }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("exceeds maximum allowed length");
  });

  it("streams NDJSON events and returns structured mission result", async () => {
    const req = new NextRequest("http://localhost:3000/api/agent/orchestrator", {
      method: "POST",
      body: JSON.stringify({
        missionId: "mission-test-stream",
        mission: "Create hello.ts in sandbox and verify it",
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");

    expect(res.body).toBeDefined();
    const rawOutput = await readStreamToString(res.body!);

    const lines = rawOutput
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    expect(lines.length).toBeGreaterThan(0);

    const parsedEvents = lines.map((l) => JSON.parse(l));

    // Verify presence of lifecycle events
    const eventTypes = parsedEvents.map((e) => e.type);
    expect(eventTypes).toContain("SANDBOX_CREATED");
    expect(eventTypes).toContain("SANDBOX_READY");
    expect(eventTypes).toContain("STREAM_END");

    // Check that no secret API keys exist in any payload
    const allText = JSON.stringify(parsedEvents);
    expect(allText).not.toContain("AIzaSy");
    expect(allText).not.toContain("sk-ant-");
    expect(allText).not.toContain("sk-proj-");
    expect(allText).not.toContain("e2b_");
  }, 15_000);

  it("isolates event bus streams so events are not leaked between different missions", async () => {
    const missionId1 = "mission-iso-1";
    const missionId2 = "mission-iso-2";

    const req1 = new NextRequest("http://localhost:3000/api/agent/orchestrator", {
      method: "POST",
      body: JSON.stringify({ missionId: missionId1, mission: "Task for mission 1" }),
      headers: { "content-type": "application/json" },
    });

    const res1 = await POST(req1);
    expect(res1.body).toBeDefined();

    // Emit event targeted at mission 2 on global event bus
    legionEventBus.emit({
      missionId: missionId2,
      type: "TASK_STARTED",
      taskId: "task-other",
      taskTitle: "Other task",
      assignedRole: "BUILDER",
      status: "IN_PROGRESS",
      priority: "HIGH",
      message: "This should NOT appear in stream 1",
    });

    const rawOutput1 = await readStreamToString(res1.body!);
    const parsed1 = rawOutput1
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => JSON.parse(l));

    // Ensure none of the events in stream 1 belong to mission 2
    expect(rawOutput1).not.toContain("This should NOT appear in stream 1");
    for (const evt of parsed1) {
      if (evt.missionId) {
        expect(evt.missionId).toBe(missionId1);
      }
      if (evt.message) {
        expect(evt.message).not.toContain("This should NOT appear in stream 1");
      }
    }
  }, 15_000);

  it("handles request abort signal cleanly", async () => {
    const controller = new AbortController();

    const req = new NextRequest("http://localhost:3000/api/agent/orchestrator", {
      method: "POST",
      body: JSON.stringify({ mission: "Abort mission" }),
      headers: { "content-type": "application/json" },
      signal: controller.signal,
    });

    controller.abort();

    const res = await POST(req);
    expect(res.status).toBe(200);
    const rawOutput = await readStreamToString(res.body!);
    expect(rawOutput).toBeDefined();
  });
});
