// API Route Handler: /api/sandbox/diagnostic
// Streams live execution telemetry events to the browser

import { NextRequest } from "next/server";
import { SandboxService } from "@/lib/sandbox/sandbox-service";
import { LegionEvent } from "@/types/events";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const missionId = typeof body.missionId === "string" && body.missionId ? body.missionId : "mission-001";

    const encoder = new TextEncoder();
    const service = new SandboxService();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (evt: unknown) => {
          try {
            const chunk = encoder.encode(JSON.stringify(evt) + "\n");
            controller.enqueue(chunk);
          } catch {
            // Stream might be closed by client
          }
        };

        try {
          const summary = await service.runDiagnostic(missionId, {
            onEvent: (eventPayload) => {
              sendEvent({ event: eventPayload });
            },
          });

          sendEvent({ summary });
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          sendEvent({ error: errorMsg });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
