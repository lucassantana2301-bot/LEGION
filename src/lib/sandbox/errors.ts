// LEGION Sandbox Error Hierarchy

export class SandboxError extends Error {
  public readonly code: string;
  public readonly isSandboxError = true;

  constructor(message: string, code: string = "SANDBOX_ERROR") {
    super(message);
    this.name = "SandboxError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SandboxTimeoutError extends SandboxError {
  public readonly timeoutMs: number;

  constructor(message: string, timeoutMs: number) {
    super(message, "SANDBOX_TIMEOUT");
    this.name = "SandboxTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export class SandboxUnavailableError extends SandboxError {
  constructor(message: string) {
    super(message, "SANDBOX_UNAVAILABLE");
    this.name = "SandboxUnavailableError";
  }
}

export class SandboxPathError extends SandboxError {
  public readonly requestedPath: string;

  constructor(message: string, requestedPath: string) {
    super(message, "SANDBOX_PATH_ERROR");
    this.name = "SandboxPathError";
    this.requestedPath = requestedPath;
  }
}

export class SandboxExecutionError extends SandboxError {
  public readonly exitCode?: number;
  public readonly stderr?: string;

  constructor(message: string, exitCode?: number, stderr?: string) {
    super(message, "SANDBOX_EXECUTION_ERROR");
    this.name = "SandboxExecutionError";
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

export class SandboxCommandValidationError extends SandboxError {
  public readonly rejectedCommand: string;

  constructor(message: string, rejectedCommand: string) {
    super(message, "COMMAND_VALIDATION_ERROR");
    this.name = "SandboxCommandValidationError";
    this.rejectedCommand = rejectedCommand;
  }
}
