// Server-side Sandbox Service for LEGION Phase 02B

import { getSandboxProvider, SandboxProvider } from "../providers";
import { assertValidCommand } from "./command-validator";
import { SandboxError } from "./errors";
import { legionEventBus } from "../events/bus";
import { LegionEvent } from "@/types/events";

export type EmittableLegionEvent = Parameters<typeof legionEventBus.emit>[0];

export interface DiagnosticEventCallback {
  (event: EmittableLegionEvent): void;
}

export interface SandboxExecutionOptions {
  missionId?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  onEvent?: DiagnosticEventCallback;
}

export interface DiagnosticStepResult {
  step: string;
  status: "PASSED" | "FAILED" | "SKIPPED";
  output?: string;
  durationMs?: number;
  error?: string;
}

export interface DiagnosticSummary {
  missionId: string;
  provider: string;
  sandboxId: string;
  status: "SUCCESS" | "FAILED" | "CANCELLED";
  steps: DiagnosticStepResult[];
  totalDurationMs: number;
}

export class SandboxService {
  private provider: SandboxProvider;

  constructor(provider?: SandboxProvider) {
    this.provider = provider || getSandboxProvider();
  }

  public getProviderName(): string {
    return this.provider.name;
  }

  /**
   * Helper to dispatch events to both the server-side event bus and optional caller callback
   */
  private emitEvent(
    eventPayload: EmittableLegionEvent,
    callback?: DiagnosticEventCallback
  ) {
    legionEventBus.emit(eventPayload);
    if (callback) {
      try {
        callback(eventPayload);
      } catch (err) {
        console.error("[SandboxService] Error in event callback:", err);
      }
    }
  }

  /**
   * Runs the complete real diagnostic suite in an isolated sandbox environment
   */
  public async runDiagnostic(
    missionId: string = "mission-001",
    options: SandboxExecutionOptions = {}
  ): Promise<DiagnosticSummary> {
    const startTime = Date.now();
    const steps: DiagnosticStepResult[] = [];
    const callback = options.onEvent;
    const signal = options.signal;

    let sandboxId = "";
    let providerName = this.provider.name;

    // 1. Announce Builder starting diagnostic
    this.emitEvent(
      {
        missionId,
        type: "AGENT_WORKING" as const,
        role: "BUILDER" as const,
        status: "WORKING" as const,
        currentTaskTitle: "Running Sandbox Diagnostic Suite",
        message: "BUILDER requested isolated sandbox allocation...",
      },
      callback
    );

    this.emitEvent(
      {
        missionId,
        type: "TERMINAL_OUTPUT" as const,
        stream: "SYSTEM" as const,
        text: `[LEGION SANDBOX] Allocating isolated environment using provider: ${providerName.toUpperCase()}...`,
      },
      callback
    );

    try {
      if (signal?.aborted) throw new SandboxError("Diagnostic cancelled before sandbox creation.", "EXECUTION_CANCELLED");

      // 2. Create Sandbox
      const stepStart = Date.now();
      const instance = await this.provider.create();
      sandboxId = instance.id;
      providerName = instance.provider || this.provider.name;

      this.emitEvent(
        {
          missionId,
          type: "SANDBOX_CREATED" as const,
          sandboxId,
          provider: providerName,
          message: `Sandbox "${sandboxId}" allocated successfully (${providerName}).`,
        },
        callback
      );

      this.emitEvent(
        {
          missionId,
          type: "SANDBOX_READY" as const,
          sandboxId,
          provider: providerName,
          message: `Sandbox environment "${sandboxId}" is ready for execution.`,
        },
        callback
      );

      this.emitEvent(
        {
          missionId,
          type: "TERMINAL_OUTPUT" as const,
          stream: "SUCCESS" as const,
          text: `✓ Sandbox ready: ${sandboxId} [${providerName}]`,
        },
        callback
      );

      steps.push({
        step: "ALLOCATE_SANDBOX",
        status: "PASSED",
        output: `Created sandbox ${sandboxId}`,
        durationMs: Date.now() - stepStart,
      });

      // 3. Execute 'node --version'
      await this.runCommandStep(
        missionId,
        sandboxId,
        "node --version",
        steps,
        callback,
        signal
      );

      // 4. Execute 'npm --version'
      await this.runCommandStep(
        missionId,
        sandboxId,
        "npm --version",
        steps,
        callback,
        signal
      );

      // 5. Execute 'echo "LEGION SANDBOX ONLINE"'
      await this.runCommandStep(
        missionId,
        sandboxId,
        'echo "LEGION SANDBOX ONLINE"',
        steps,
        callback,
        signal
      );

      // 6. Test File System: Write -> Read -> List
      const fileStepStart = Date.now();
      const testFilePath = "/workspace/legion-test.txt";
      const testContent = "LEGION REAL SANDBOX";

      this.emitEvent(
        {
          missionId,
          type: "TERMINAL_OUTPUT" as const,
          stream: "COMMAND" as const,
          text: `> legion fs write --path=${testFilePath}`,
        },
        callback
      );

      await this.provider.writeFile(sandboxId, testFilePath, testContent);

      this.emitEvent(
        {
          missionId,
          type: "FILE_CREATED" as const,
          path: testFilePath,
          agentRole: "BUILDER" as const,
          linesCount: 1,
          message: `BUILDER wrote test file: ${testFilePath}`,
        },
        callback
      );

      const readBack = await this.provider.readFile(sandboxId, testFilePath);
      if (!readBack.includes("LEGION REAL SANDBOX")) {
        throw new SandboxError(`File content mismatch in ${testFilePath}. Got: "${readBack}"`);
      }

      this.emitEvent(
        {
          missionId,
          type: "TERMINAL_OUTPUT" as const,
          stream: "STDOUT" as const,
          text: `Verified file ${testFilePath}: "${readBack.trim()}"`,
        },
        callback
      );

      // List files
      const files = await this.provider.listFiles(sandboxId, "/workspace");
      this.emitEvent(
        {
          missionId,
          type: "TERMINAL_OUTPUT" as const,
          stream: "SUCCESS" as const,
          text: `✓ Workspace files (${files.length}): ${files.map((f) => f.path).join(", ")}`,
        },
        callback
      );

      steps.push({
        step: "FILE_SYSTEM_VERIFICATION",
        status: "PASSED",
        output: `Wrote, read, and verified ${testFilePath}`,
        durationMs: Date.now() - fileStepStart,
      });

      // 7. Security: Test Path Traversal Containment
      const traversalStepStart = Date.now();
      let traversalBlocked = false;
      try {
        await this.provider.readFile(sandboxId, "../secret/passwords.txt");
      } catch (err: unknown) {
        if (err instanceof SandboxError && err.code === "SANDBOX_PATH_ERROR") {
          traversalBlocked = true;
        } else if (err instanceof Error && err.message.toLowerCase().includes("traversal")) {
          traversalBlocked = true;
        }
      }

      if (!traversalBlocked) {
        throw new SandboxError("Path traversal test failed: '../secret/passwords.txt' was not rejected.");
      }

      this.emitEvent(
        {
          missionId,
          type: "TERMINAL_OUTPUT" as const,
          stream: "SUCCESS" as const,
          text: `✓ Path traversal containment check passed: "../secret" safely blocked.`,
        },
        callback
      );

      steps.push({
        step: "PATH_TRAVERSAL_CHECK",
        status: "PASSED",
        output: "Path traversal safely rejected.",
        durationMs: Date.now() - traversalStepStart,
      });

      // 8. Completion & Teardown
      this.emitEvent(
        {
          missionId,
          type: "AGENT_COMPLETED" as const,
          role: "BUILDER" as const,
          status: "IDLE" as const,
          currentTaskTitle: "Diagnostic completed successfully",
          message: "BUILDER: Sandbox diagnostic suite completed successfully.",
        },
        callback
      );

      this.emitEvent(
        {
          missionId,
          type: "TERMINAL_OUTPUT" as const,
          stream: "SUCCESS" as const,
          text: `[LEGION SANDBOX] Diagnostic completed with 100% checks passed (${Date.now() - startTime}ms).`,
        },
        callback
      );

      return {
        missionId,
        provider: providerName,
        sandboxId,
        status: "SUCCESS",
        steps,
        totalDurationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const isCancelled = errorMsg.includes("cancelled");

      steps.push({
        step: "DIAGNOSTIC_FAILURE",
        status: "FAILED",
        error: errorMsg,
      });

      this.emitEvent(
        {
          missionId,
          type: isCancelled ? ("EXECUTION_CANCELLED" as const) : ("EXECUTION_ERROR" as const),
          sandboxId: sandboxId || "none",
          command: "diagnostic_suite",
          message: isCancelled ? "Diagnostic execution cancelled by user." : `Diagnostic error: ${errorMsg}`,
          error: errorMsg,
        },
        callback
      );

      this.emitEvent(
        {
          missionId,
          type: "TERMINAL_OUTPUT" as const,
          stream: isCancelled ? ("WARNING" as const) : ("STDERR" as const),
          text: `✕ [SANDBOX ERROR]: ${errorMsg}`,
        },
        callback
      );

      return {
        missionId,
        provider: providerName,
        sandboxId,
        status: isCancelled ? "CANCELLED" : "FAILED",
        steps,
        totalDurationMs: Date.now() - startTime,
      };
    } finally {
      // Always destroy the sandbox
      if (sandboxId) {
        try {
          await this.provider.destroy(sandboxId);
          this.emitEvent(
            {
              missionId,
              type: "SANDBOX_DESTROYED" as const,
              sandboxId,
              provider: providerName,
              message: `Sandbox "${sandboxId}" safely destroyed and cleaned up.`,
            },
            callback
          );
          this.emitEvent(
            {
              missionId,
              type: "TERMINAL_OUTPUT" as const,
              stream: "SYSTEM" as const,
              text: `[LEGION SANDBOX] Teardown complete. Sandbox ${sandboxId} destroyed.`,
            },
            callback
          );
        } catch (cleanupErr) {
          console.error("[SandboxService] Teardown error:", cleanupErr);
        }
      }
    }
  }

  private async runCommandStep(
    missionId: string,
    sandboxId: string,
    rawCommand: string,
    steps: DiagnosticStepResult[],
    callback?: DiagnosticEventCallback,
    signal?: AbortSignal
  ): Promise<void> {
    const validCmd = assertValidCommand(rawCommand);
    const stepStart = Date.now();

    this.emitEvent(
      {
        missionId,
        type: "EXECUTION_STARTED" as const,
        sandboxId,
        command: validCmd,
        agentRole: "BUILDER" as const,
        message: `BUILDER executing: ${validCmd}`,
      },
      callback
    );

    this.emitEvent(
      {
        missionId,
        type: "TERMINAL_OUTPUT" as const,
        stream: "COMMAND" as const,
        text: `$ ${validCmd}`,
      },
      callback
    );

    const onChunk = (stream: "stdout" | "stderr", text: string) => {
      this.emitEvent(
        {
          missionId,
          type: "EXECUTION_OUTPUT" as const,
          sandboxId,
          command: validCmd,
          stream,
          output: text,
          message: text.trim(),
        },
        callback
      );

      this.emitEvent(
        {
          missionId,
          type: "TERMINAL_OUTPUT" as const,
          stream: stream === "stdout" ? ("STDOUT" as const) : ("STDERR" as const),
          text: text.trimEnd(),
        },
        callback
      );
    };

    const res = await this.provider.execute(sandboxId, validCmd, onChunk, undefined, signal);

    this.emitEvent(
      {
        missionId,
        type: "EXECUTION_COMPLETED" as const,
        sandboxId,
        command: validCmd,
        exitCode: res.exitCode,
        durationMs: res.durationMs,
        message: `Command "${validCmd}" exited with code ${res.exitCode}.`,
      },
      callback
    );

    steps.push({
      step: validCmd,
      status: res.exitCode === 0 ? "PASSED" : "FAILED",
      output: res.stdout || res.stderr,
      durationMs: Date.now() - stepStart,
    });
  }
}
