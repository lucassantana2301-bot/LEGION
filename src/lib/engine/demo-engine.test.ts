import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { legionEventBus } from "@/lib/events/bus";
import { LegionEventType } from "@/types/events";
import { DemoMissionEngine } from "./demo-engine";

describe("DemoMissionEngine", () => {
  beforeEach(() => {
    legionEventBus.reset();
    vi.useFakeTimers();
    delete process.env.MAX_MISSION_ITERATIONS;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.MAX_MISSION_ITERATIONS;
  });

  it("satisfies the MissionEngine status contract before starting", () => {
    const engine = new DemoMissionEngine("mission-test");
    expect(engine.getStatus()).toEqual({
      missionId: "mission-test",
      isRunning: false,
      isPaused: false,
      stepIndex: 0,
    });
  });

  it("emits MISSION_STARTED as the first event once started", () => {
    const types: LegionEventType[] = [];
    legionEventBus.subscribe("*", (e) => types.push(e.type));

    const engine = new DemoMissionEngine("mission-test");
    engine.start();
    vi.advanceTimersByTime(300);

    expect(types).toContain("MISSION_STARTED");
  });

  it("runs the full failure-loop narrative through to MISSION_COMPLETED", () => {
    const types: LegionEventType[] = [];
    legionEventBus.subscribe("*", (e) => types.push(e.type));

    const engine = new DemoMissionEngine("mission-test");
    engine.start();
    vi.runAllTimers();

    expect(types).toContain("TEST_FAILED");
    expect(types).toContain("ISSUE_CREATED");
    expect(types).toContain("ISSUE_ASSIGNED");
    expect(types).toContain("ISSUE_RESOLVED");
    expect(types).toContain("TASK_COMPLETED");
    expect(types).toContain("MISSION_COMPLETED");
    expect(engine.getStatus().isRunning).toBe(false);
  });

  it("pause() stops the timer, and resume() continues without replaying earlier steps", () => {
    const types: LegionEventType[] = [];
    legionEventBus.subscribe("*", (e) => types.push(e.type));

    const engine = new DemoMissionEngine("mission-test");
    engine.start();
    vi.advanceTimersByTime(300); // step 0 fires
    engine.pause();
    expect(types).toContain("MISSION_PAUSED");

    const countAfterPause = types.length;
    vi.advanceTimersByTime(5000);
    expect(types.length).toBe(countAfterPause); // nothing fires while paused

    engine.resume();
    expect(types).toContain("MISSION_RESUMED");
    vi.advanceTimersByTime(1400); // step 1's delay
    expect(types).toContain("AGENT_COMMUNICATION");
  });

  it("stop() halts execution and resets the step index", () => {
    const engine = new DemoMissionEngine("mission-test");
    engine.start();
    vi.advanceTimersByTime(300);
    engine.stop();

    const status = engine.getStatus();
    expect(status.isRunning).toBe(false);
    expect(status.stepIndex).toBe(0);
  });

  it("stops and emits MISSION_FAILED once MAX_MISSION_ITERATIONS is exceeded", () => {
    process.env.MAX_MISSION_ITERATIONS = "2";
    const types: LegionEventType[] = [];
    legionEventBus.subscribe("*", (e) => types.push(e.type));

    const engine = new DemoMissionEngine("mission-test");
    engine.start();
    vi.runAllTimers();

    expect(types).toContain("MISSION_FAILED");
    expect(types).not.toContain("MISSION_COMPLETED");
    expect(engine.getStatus().isRunning).toBe(false);
  });
});
