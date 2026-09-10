import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { streamMission, MissionStreamError } from "./mission-stream";
import { MissionStreamEventEnvelope } from "@/types/stream";

describe("streamMission (Client-Side NDJSON Stream Parser)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function createMockNdjsonStream(chunks: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });
  }

  it("parses multi-line NDJSON stream and triggers onEvent callbacks in order", async () => {
    const event1: MissionStreamEventEnvelope = {
      type: "MISSION_PLANNING",
      missionId: "m-1",
      timestamp: "2026-09-09T00:00:00Z",
      seq: 1,
      message: "Planning started",
    };

    const event2: MissionStreamEventEnvelope = {
      type: "TASK_STARTED",
      missionId: "m-1",
      taskId: "t-1",
      timestamp: "2026-09-09T00:00:01Z",
      seq: 2,
      message: "Task 1 started",
    };

    const event3: MissionStreamEventEnvelope = {
      type: "MISSION_COMPLETED",
      missionId: "m-1",
      timestamp: "2026-09-09T00:00:02Z",
      seq: 3,
      message: "Mission completed",
      result: {
        missionId: "m-1",
        status: "COMPLETED",
        taskResults: {},
        totalAttempts: 1,
        totalTokens: { prompt: 100, completion: 50, total: 150 },
        totalCostUsd: 0.0001,
        summary: "Success",
        startedAt: "2026-09-09T00:00:00Z",
        completedAt: "2026-09-09T00:00:02Z",
      },
    };

    // Simulate chunks split across buffer lines
    const rawChunks = [
      `${JSON.stringify(event1)}\n${JSON.stringify(event2).slice(0, 20)}`,
      `${JSON.stringify(event2).slice(20)}\n`,
      `${JSON.stringify(event3)}\n`,
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: createMockNdjsonStream(rawChunks),
    });

    const receivedEvents: MissionStreamEventEnvelope[] = [];

    const result = await streamMission(
      { mission: "Build test app" },
      {
        onEvent: (evt) => receivedEvents.push(evt),
      }
    );

    expect(receivedEvents).toHaveLength(3);
    expect(receivedEvents[0].type).toBe("MISSION_PLANNING");
    expect(receivedEvents[1].type).toBe("TASK_STARTED");
    expect(receivedEvents[2].type).toBe("MISSION_COMPLETED");
    expect(result).toBeDefined();
    expect(result?.status).toBe("COMPLETED");
  });

  it("throws MissionStreamError on HTTP error status (e.g. 400 Bad Request)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "The 'mission' field is required and cannot be empty." }),
    });

    await expect(
      streamMission({ mission: "" })
    ).rejects.toThrowError(MissionStreamError);
  });

  it("handles empty stream gracefully", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: createMockNdjsonStream([]),
    });

    const result = await streamMission({ mission: "Empty stream" });
    expect(result).toBeNull();
  });
});
