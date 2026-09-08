import { describe, it, expect } from "vitest";
import { validateCommand, assertValidCommand } from "./command-validator";
import { SandboxCommandValidationError } from "./errors";

describe("Command Validator (Phase 02B Security)", () => {
  it("allows safe allowed exact commands", () => {
    const allowed = [
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
    ];

    for (const cmd of allowed) {
      const res = validateCommand(cmd);
      expect(res.valid).toBe(true);
      expect(res.command).toBe(cmd);
      expect(() => assertValidCommand(cmd)).not.toThrow();
    }
  });

  it("allows safe echo commands with safe strings", () => {
    const validEchoes = [
      'echo "LEGION SANDBOX ONLINE"',
      "echo 'LEGION SANDBOX ONLINE'",
      "echo Hello World",
      "echo Test 123",
      "echo All checks passed!",
    ];

    for (const cmd of validEchoes) {
      const res = validateCommand(cmd);
      expect(res.valid).toBe(true);
    }
  });

  it("rejects shell metacharacters and command chaining attempts", () => {
    const dangerous = [
      "node --version; rm -rf /",
      "node --version && echo hacked",
      "pwd | grep root",
      "echo `whoami`",
      "echo $(cat /etc/passwd)",
      "echo hello > /tmp/evil",
      "cat < /etc/shadow",
      "echo hello\nrm -rf /",
      "node -e 'console.log(process.env)'",
    ];

    for (const cmd of dangerous) {
      const res = validateCommand(cmd);
      expect(res.valid).toBe(false);
      expect(res.reason).toBeDefined();
      expect(() => assertValidCommand(cmd)).toThrow(SandboxCommandValidationError);
    }
  });

  it("rejects path traversal inside command arguments", () => {
    const traversalCommands = [
      "cat ../secret.txt",
      "cat ../../etc/passwd",
      "ls ../../../root",
    ];

    for (const cmd of traversalCommands) {
      const res = validateCommand(cmd);
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("Path traversal");
    }
  });

  it("rejects empty, null, or oversized commands", () => {
    expect(validateCommand("").valid).toBe(false);
    expect(validateCommand("   ").valid).toBe(false);
    expect(validateCommand("a".repeat(300)).valid).toBe(false);
  });
});
