// Server-side Command Validation for LEGION Phase 02B

import { SandboxCommandValidationError } from "./errors";

export interface CommandValidationResult {
  valid: boolean;
  command: string;
  reason?: string;
}

// Shell metacharacters that allow command chaining, redirection, or code injection
const FORBIDDEN_METACHARS = /[;&|`$><\\{}()[\n\r]/;

// Allowed safe base commands for Phase 02B demonstration
const ALLOWED_EXACT_COMMANDS = new Set([
  "node --version",
  "node -v",
  "npm --version",
  "npm -v",
  "pwd",
  "ls",
  "ls -la",
  "ls -l",
  "whoami",
  "date",
  "uname -a",
]);

export function validateCommand(rawCommand: string): CommandValidationResult {
  if (!rawCommand || typeof rawCommand !== "string") {
    return {
      valid: false,
      command: "",
      reason: "Command must be a non-empty string.",
    };
  }

  const trimmed = rawCommand.trim();

  if (trimmed.length === 0) {
    return {
      valid: false,
      command: "",
      reason: "Command cannot be empty.",
    };
  }

  if (trimmed.length > 256) {
    return {
      valid: false,
      command: trimmed,
      reason: "Command exceeds maximum length of 256 characters.",
    };
  }

  // Check for forbidden metacharacters (subshells, pipes, chaining, redirection)
  if (FORBIDDEN_METACHARS.test(trimmed)) {
    return {
      valid: false,
      command: trimmed,
      reason: `Forbidden shell metacharacters detected in command: "${trimmed}". Chaining, redirection, and subshells are disabled for security.`,
    };
  }

  // Check exact matches
  if (ALLOWED_EXACT_COMMANDS.has(trimmed)) {
    return {
      valid: true,
      command: trimmed,
    };
  }

  // Check safe parameterized commands: echo <safe-string>
  if (trimmed.startsWith("echo ") || trimmed.startsWith("echo\t")) {
    const argument = trimmed.slice(5).trim();
    // Verify no quotes escape or dangerous control characters
    if (/^[a-zA-Z0-9 _.,:!?'"/-]+$/.test(argument)) {
      return {
        valid: true,
        command: trimmed,
      };
    }
    return {
      valid: false,
      command: trimmed,
      reason: "Echo argument contains invalid or unsafe characters.",
    };
  }

  // Check safe parameterized commands: ls <path>
  if (trimmed.startsWith("ls ") || trimmed.startsWith("cat ")) {
    const parts = trimmed.split(/\s+/);
    const cmd = parts[0];
    const pathArg = parts.slice(1).join(" ");
    if (pathArg.includes("..")) {
      return {
        valid: false,
        command: trimmed,
        reason: "Path traversal '..' is forbidden in command arguments.",
      };
    }
    if (/^[a-zA-Z0-9_./-]+$/.test(pathArg)) {
      return {
        valid: true,
        command: trimmed,
      };
    }
    return {
      valid: false,
      command: trimmed,
      reason: `Unsafe characters in ${cmd} path argument.`,
    };
  }

  // Check safe parameterized commands: node <script>, npx tsx <script>, npx tsc <args>
  if (
    trimmed.startsWith("node ") ||
    trimmed.startsWith("npx tsx ") ||
    trimmed.startsWith("npx ts-node ") ||
    trimmed.startsWith("npx tsc") ||
    trimmed.startsWith("npm test") ||
    trimmed.startsWith("npm run ")
  ) {
    if (trimmed.includes("..")) {
      return {
        valid: false,
        command: trimmed,
        reason: "Path traversal '..' is forbidden in command arguments.",
      };
    }
    // Allow safe filename/flags arguments
    if (/^[a-zA-Z0-9 _./:=-]+$/.test(trimmed)) {
      return {
        valid: true,
        command: trimmed,
      };
    }
    return {
      valid: false,
      command: trimmed,
      reason: "Execution command contains unsafe characters or unsupported flags.",
    };
  }

  return {
    valid: false,
    command: trimmed,
    reason: `Command "${trimmed}" is not in the allowed command set for LEGION Sandbox. Permitted: node, npm, npx tsx/tsc, echo, pwd, ls, cat, whoami, date, uname.`,
  };
}

export function assertValidCommand(rawCommand: string): string {
  const result = validateCommand(rawCommand);
  if (!result.valid) {
    throw new SandboxCommandValidationError(
      result.reason || `Command rejected: "${rawCommand}"`,
      rawCommand
    );
  }
  return result.command;
}
