// Typed Agent Tool Contracts and Dispatcher for LEGION Builders

import { SandboxProvider } from "../providers/sandbox";
import { assertValidCommand } from "../sandbox/command-validator";
import { LLMToolDefinition } from "../providers/llm";
import { SandboxError } from "../sandbox/errors";

export interface ToolExecutionResult {
  tool: string;
  success: boolean;
  output: string;
  durationMs: number;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  error?: string;
}

/**
 * Standard JSON schema tool definitions for LLMs
 */
export const BUILDER_TOOL_DEFINITIONS: LLMToolDefinition[] = [
  {
    name: "writeFile",
    description: "Create or overwrite a file in the sandbox workspace.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path to the file inside the workspace (e.g. 'hello.ts', 'src/index.js').",
        },
        content: {
          type: "string",
          description: "The complete file contents to write.",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "readFile",
    description: "Read the full text content of a file in the sandbox workspace.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path to the file to read.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "listFiles",
    description: "List files and directories in the sandbox workspace.",
    parameters: {
      type: "object",
      properties: {
        directoryPath: {
          type: "string",
          description: "Optional relative directory path (defaults to workspace root).",
        },
      },
    },
  },
  {
    name: "executeSafeCommand",
    description:
      "Execute an allowed command inside the sandbox (e.g. 'node hello.js', 'npx tsx hello.ts', 'npm test'). Arbitrary shell scripts or chained commands are forbidden.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The command string to execute (e.g. 'node hello.ts' or 'npx tsx hello.ts').",
        },
        timeoutMs: {
          type: "number",
          description: "Optional execution timeout in milliseconds (default: 30000ms).",
        },
      },
      required: ["command"],
    },
  },
];

/**
 * Dispatches and executes an approved tool inside the sandbox environment
 */
export async function executeAgentTool(
  sandbox: SandboxProvider,
  sandboxId: string,
  toolName: string,
  args: Record<string, unknown>,
  onCommandOutput?: (stream: "stdout" | "stderr", text: string) => void,
  signal?: AbortSignal
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  try {
    switch (toolName) {
      case "writeFile": {
        const filePath = typeof args.path === "string" ? args.path : "";
        const content = typeof args.content === "string" ? args.content : "";
        if (!filePath) {
          throw new SandboxError("Missing required parameter 'path' for writeFile.");
        }
        await sandbox.writeFile(sandboxId, filePath, content);
        return {
          tool: "writeFile",
          success: true,
          output: `Successfully wrote ${Buffer.byteLength(content, "utf-8")} bytes to "${filePath}".`,
          durationMs: Date.now() - startTime,
        };
      }

      case "readFile": {
        const filePath = typeof args.path === "string" ? args.path : "";
        if (!filePath) {
          throw new SandboxError("Missing required parameter 'path' for readFile.");
        }
        const content = await sandbox.readFile(sandboxId, filePath);
        return {
          tool: "readFile",
          success: true,
          output: content,
          durationMs: Date.now() - startTime,
        };
      }

      case "listFiles": {
        const dir = typeof args.directoryPath === "string" ? args.directoryPath : ".";
        const files = await sandbox.listFiles(sandboxId, dir);
        const formatted = files.map((f) => `${f.isDirectory ? "[DIR]" : "[FILE]"} ${f.path}`).join("\n");
        return {
          tool: "listFiles",
          success: true,
          output: formatted || "(empty directory)",
          durationMs: Date.now() - startTime,
        };
      }

      case "executeSafeCommand": {
        const command = typeof args.command === "string" ? args.command : "";
        const timeoutMs = typeof args.timeoutMs === "number" ? args.timeoutMs : undefined;

        if (!command) {
          throw new SandboxError("Missing required parameter 'command' for executeSafeCommand.");
        }

        // Validate command against strict allowlist and metacharacter rules
        assertValidCommand(command);

        const result = await sandbox.execute(sandboxId, command, onCommandOutput, timeoutMs, signal);

        const outputParts = [];
        if (result.stdout.trim()) {
          outputParts.push(`STDOUT:\n${result.stdout.trim()}`);
        }
        if (result.stderr.trim()) {
          outputParts.push(`STDERR:\n${result.stderr.trim()}`);
        }
        outputParts.push(`EXIT CODE: ${result.exitCode}`);

        return {
          tool: "executeSafeCommand",
          success: result.exitCode === 0,
          output: outputParts.join("\n\n"),
          durationMs: result.durationMs,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        };
      }

      default:
        throw new SandboxError(`Unknown tool "${toolName}". Allowed tools: writeFile, readFile, listFiles, executeSafeCommand.`);
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      tool: toolName,
      success: false,
      output: `Error executing tool "${toolName}": ${errorMsg}`,
      durationMs: Date.now() - startTime,
      error: errorMsg,
    };
  }
}
