// LEGION Client-Side Mission Stream Consumer
// Safely streams NDJSON events from /api/agent/orchestrator to UI listeners

import { MissionStreamEventEnvelope, MissionStreamRequest } from "@/types/stream";
import { OrchestratorResult } from "@/lib/agent/orchestrator";

export interface StreamMissionOptions {
  onEvent?: (event: MissionStreamEventEnvelope) => void;
  signal?: AbortSignal;
  baseUrl?: string;
}

export class MissionStreamError extends Error {
  public readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "MissionStreamError";
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Executes a mission via the server-side orchestrator and streams real-time NDJSON events
 */
export async function streamMission(
  request: MissionStreamRequest,
  options: StreamMissionOptions = {}
): Promise<OrchestratorResult | null> {
  const baseUrl = options.baseUrl || "";
  const endpoint = `${baseUrl}/api/agent/orchestrator`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/x-ndjson",
    },
    body: JSON.stringify(request),
    signal: options.signal,
  });

  if (!response.ok) {
    let errorText = "";
    try {
      const errJson = await response.json();
      errorText = errJson.error || JSON.stringify(errJson);
    } catch {
      errorText = await response.text();
    }
    throw new MissionStreamError(
      `Mission execution request failed (${response.status}): ${errorText}`,
      response.status
    );
  }

  if (!response.body) {
    throw new MissionStreamError("Response body is empty. Streaming not supported by environment.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let finalResult: OrchestratorResult | null = null;

  try {
    while (true) {
      if (options.signal?.aborted) {
        break;
      }

      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // Keep the last incomplete fragment in the buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const parsed = JSON.parse(trimmed) as MissionStreamEventEnvelope;
          options.onEvent?.(parsed);

          if (parsed.result) {
            finalResult = parsed.result;
          }
        } catch {
          // Ignore invalid chunk lines
        }
      }
    }

    // Process any remaining bytes in buffer
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim()) as MissionStreamEventEnvelope;
        options.onEvent?.(parsed);
        if (parsed.result) {
          finalResult = parsed.result;
        }
      } catch {
        // Trailing byte parse error ignored
      }
    }
  } finally {
    reader.releaseLock();
  }

  return finalResult;
}
