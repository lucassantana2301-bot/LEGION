// Execution guardrails read from environment configuration (see .env.example).

export interface ExecutionLimits {
  maxMissionIterations: number;
  sandboxTimeoutMs: number;
  maxOutputBytes: number;
  maxTerminalLines: number;
}

const DEFAULT_MAX_MISSION_ITERATIONS = 50;
const DEFAULT_SANDBOX_TIMEOUT_MS = 30000;
const DEFAULT_MAX_OUTPUT_BYTES = 65536; // 64 KB
const DEFAULT_MAX_TERMINAL_LINES = 500;

export function getExecutionLimits(): ExecutionLimits {
  const rawIterations = process.env.MAX_MISSION_ITERATIONS;
  const parsedIterations = rawIterations ? Number.parseInt(rawIterations, 10) : NaN;

  const rawTimeout = process.env.SANDBOX_TIMEOUT_MS;
  const parsedTimeout = rawTimeout ? Number.parseInt(rawTimeout, 10) : NaN;

  const rawMaxBytes = process.env.MAX_OUTPUT_BYTES;
  const parsedMaxBytes = rawMaxBytes ? Number.parseInt(rawMaxBytes, 10) : NaN;

  const rawMaxLines = process.env.MAX_TERMINAL_LINES;
  const parsedMaxLines = rawMaxLines ? Number.parseInt(rawMaxLines, 10) : NaN;

  return {
    maxMissionIterations:
      Number.isFinite(parsedIterations) && parsedIterations > 0
        ? parsedIterations
        : DEFAULT_MAX_MISSION_ITERATIONS,
    sandboxTimeoutMs:
      Number.isFinite(parsedTimeout) && parsedTimeout > 0
        ? parsedTimeout
        : DEFAULT_SANDBOX_TIMEOUT_MS,
    maxOutputBytes:
      Number.isFinite(parsedMaxBytes) && parsedMaxBytes > 0
        ? parsedMaxBytes
        : DEFAULT_MAX_OUTPUT_BYTES,
    maxTerminalLines:
      Number.isFinite(parsedMaxLines) && parsedMaxLines > 0
        ? parsedMaxLines
        : DEFAULT_MAX_TERMINAL_LINES,
  };
}
