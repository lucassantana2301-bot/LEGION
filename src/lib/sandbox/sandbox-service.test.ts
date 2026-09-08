import { describe, it, expect, beforeEach } from "vitest";
import { SandboxService } from "./sandbox-service";
import { MockSandboxProvider } from "../providers/sandbox";
import { legionEventBus } from "../events/bus";
import { LegionEvent } from "@/types/events";

describe("SandboxService (Phase 02B)", () => {
  beforeEach(() => {
    legionEventBus.reset();
  });

  it("executes the full diagnostic suite cleanly with MockSandboxProvider", async () => {
    const mockProvider = new MockSandboxProvider();
    const service = new SandboxService(mockProvider);

    const emittedEvents: LegionEvent[] = [];
    const unsubscribe = legionEventBus.subscribe("*", (evt) => {
      emittedEvents.push(evt);
    });

    const summary = await service.runDiagnostic("mission-test-01");

    unsubscribe();

    expect(summary.status).toBe("SUCCESS");
    expect(summary.steps.length).toBeGreaterThanOrEqual(6);
    expect(summary.steps.every((s) => s.status === "PASSED")).toBe(true);

    // Verify key steps
    const stepNames = summary.steps.map((s) => s.step);
    expect(stepNames).toContain("ALLOCATE_SANDBOX");
    expect(stepNames).toContain("node --version");
    expect(stepNames).toContain("npm --version");
    expect(stepNames).toContain('echo "LEGION SANDBOX ONLINE"');
    expect(stepNames).toContain("FILE_SYSTEM_VERIFICATION");
    expect(stepNames).toContain("PATH_TRAVERSAL_CHECK");

    // Verify event stream emission
    const eventTypes = emittedEvents.map((e) => e.type);
    expect(eventTypes).toContain("AGENT_WORKING");
    expect(eventTypes).toContain("SANDBOX_CREATED");
    expect(eventTypes).toContain("SANDBOX_READY");
    expect(eventTypes).toContain("EXECUTION_STARTED");
    expect(eventTypes).toContain("EXECUTION_COMPLETED");
    expect(eventTypes).toContain("FILE_CREATED");
    expect(eventTypes).toContain("AGENT_COMPLETED");
    expect(eventTypes).toContain("SANDBOX_DESTROYED");
  });

  it("handles cancellation gracefully via AbortSignal", async () => {
    const mockProvider = new MockSandboxProvider();
    const service = new SandboxService(mockProvider);

    const controller = new AbortController();
    controller.abort(); // pre-aborted

    const summary = await service.runDiagnostic("mission-test-cancel", {
      signal: controller.signal,
    });

    expect(summary.status).toBe("CANCELLED");
  });

  it("forwards streaming events to caller callback", async () => {
    const mockProvider = new MockSandboxProvider();
    const service = new SandboxService(mockProvider);

    const callbackEvents: unknown[] = [];
    const summary = await service.runDiagnostic("mission-test-stream", {
      onEvent: (evt) => callbackEvents.push(evt),
    });

    expect(summary.status).toBe("SUCCESS");
    expect(callbackEvents.length).toBeGreaterThan(5);
  });
});
