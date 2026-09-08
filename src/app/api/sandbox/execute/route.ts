// API Route Handler: /api/sandbox/execute
// Validates and executes individual safe commands in isolated sandbox

import { NextRequest } from "next/server";
import { assertValidCommand } from "@/lib/sandbox/command-validator";
import { getSandboxProvider } from "@/lib/providers";
import { SandboxError } from "@/lib/sandbox/errors";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let sandboxId = "";
  const provider = getSandboxProvider();

  try {
    const body = await req.json().catch(() => ({}));
    const rawCommand = body.command;

    if (!rawCommand || typeof rawCommand !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'command' field in request body." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate server-side
    const validatedCommand = assertValidCommand(rawCommand);

    // Create ephemeral sandbox for single execution
    const instance = await provider.create();
    sandboxId = instance.id;

    const result = await provider.execute(sandboxId, validatedCommand);

    return new Response(
      JSON.stringify({
        command: validatedCommand,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs: result.durationMs,
        provider: instance.provider || provider.name,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const statusCode = err instanceof SandboxError && err.code === "COMMAND_VALIDATION_ERROR" ? 400 : 500;

    return new Response(JSON.stringify({ error: errorMsg }), {
      status: statusCode,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    if (sandboxId) {
      await provider.destroy(sandboxId).catch(() => {});
    }
  }
}
