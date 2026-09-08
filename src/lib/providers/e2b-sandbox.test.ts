import { describe, it, expect } from "vitest";
import { E2BSandboxProvider } from "./e2b-sandbox";
import { resolveSandboxPath } from "./sandbox";
import { SandboxPathError, SandboxUnavailableError } from "../sandbox/errors";

describe("E2BSandboxProvider (Contract & Boundary)", () => {
  it("throws SandboxUnavailableError when E2B_API_KEY is missing", async () => {
    const originalKey = process.env.E2B_API_KEY;
    delete process.env.E2B_API_KEY;

    try {
      const provider = new E2BSandboxProvider();
      await expect(provider.create()).rejects.toThrow(SandboxUnavailableError);
    } finally {
      if (originalKey) {
        process.env.E2B_API_KEY = originalKey;
      }
    }
  });

  it("enforces path traversal rejection via resolveSandboxPath", () => {
    const root = "/home/user";

    expect(resolveSandboxPath(root, "file.txt")).toBe("/home/user/file.txt");
    expect(resolveSandboxPath(root, "subdir/nested.js")).toBe("/home/user/subdir/nested.js");

    // Traversal attempts must throw SandboxPathError
    expect(() => resolveSandboxPath(root, "../secret.txt")).toThrow(SandboxPathError);
    expect(() => resolveSandboxPath(root, "../../etc/shadow")).toThrow(SandboxPathError);
    expect(resolveSandboxPath(root, "/etc/passwd")).toBe("/home/user/etc/passwd");
  });
});

describe("E2B Real Smoke Test (Conditional)", () => {
  const hasKey = Boolean(process.env.E2B_API_KEY && process.env.E2B_API_KEY.trim().length > 0);

  it.skipIf(!hasKey)(
    "executes real E2B sandbox smoke test when API key is present",
    async () => {
      const provider = new E2BSandboxProvider();
      const instance = await provider.create();
      try {
        expect(instance.id).toBeDefined();
        expect(instance.status).toBe("RUNNING");

        const nodeRes = await provider.execute(instance.id, "node --version");
        expect(nodeRes.exitCode).toBe(0);
        expect(nodeRes.stdout).toMatch(/^v\d+/);

        const npmRes = await provider.execute(instance.id, "npm --version");
        expect(npmRes.exitCode).toBe(0);
        expect(npmRes.stdout.trim()).toBeTruthy();

        const echoRes = await provider.execute(instance.id, 'echo "LEGION SANDBOX ONLINE"');
        expect(echoRes.exitCode).toBe(0);
        expect(echoRes.stdout).toContain("LEGION SANDBOX ONLINE");

        await provider.writeFile(instance.id, "legion-test.txt", "LEGION REAL SANDBOX");
        const content = await provider.readFile(instance.id, "legion-test.txt");
        expect(content).toBe("LEGION REAL SANDBOX");

        const files = await provider.listFiles(instance.id, ".");
        expect(files.some((f) => f.path.includes("legion-test.txt"))).toBe(true);

        // Path rejection test
        await expect(provider.readFile(instance.id, "../secret")).rejects.toThrow(SandboxPathError);
      } finally {
        await provider.destroy(instance.id);
      }
    },
    60000
  );
});
