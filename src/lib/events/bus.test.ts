import { beforeEach, describe, expect, it, vi } from "vitest";
import { legionEventBus } from "./bus";
import { LegionEvent } from "@/types/events";

function missionStarted(missionId = "mission-x") {
  return {
    missionId,
    type: "MISSION_STARTED" as const,
    title: "t",
    message: "m",
  };
}

describe("legionEventBus", () => {
  beforeEach(() => {
    legionEventBus.reset();
  });

  it("dispatches to type-specific subscribers", () => {
    const received: LegionEvent[] = [];
    legionEventBus.subscribe("MISSION_STARTED", (e) => received.push(e));
    legionEventBus.emit(missionStarted());
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("MISSION_STARTED");
  });

  it("does not dispatch to subscribers of a different event type", () => {
    const received: LegionEvent[] = [];
    legionEventBus.subscribe("MISSION_PAUSED", (e) => received.push(e));
    legionEventBus.emit(missionStarted());
    expect(received).toHaveLength(0);
  });

  it("dispatches to wildcard subscribers regardless of type", () => {
    const received: LegionEvent[] = [];
    legionEventBus.subscribe("*", (e) => received.push(e));
    legionEventBus.emit(missionStarted());
    expect(received).toHaveLength(1);
  });

  it("stops delivery once unsubscribed", () => {
    const received: LegionEvent[] = [];
    const unsubscribe = legionEventBus.subscribe("MISSION_STARTED", (e) => received.push(e));
    unsubscribe();
    legionEventBus.emit(missionStarted());
    expect(received).toHaveLength(0);
  });

  it("filters delivery by missionId when subscribe() is given that option", () => {
    const received: LegionEvent[] = [];
    legionEventBus.subscribe("MISSION_STARTED", (e) => received.push(e), { missionId: "mission-a" });

    legionEventBus.emit(missionStarted("mission-b"));
    expect(received).toHaveLength(0);

    legionEventBus.emit(missionStarted("mission-a"));
    expect(received).toHaveLength(1);
  });

  it("isolates a throwing listener so other listeners still receive the event", () => {
    const received: LegionEvent[] = [];
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    legionEventBus.subscribe("MISSION_STARTED", () => {
      throw new Error("boom");
    });
    legionEventBus.subscribe("MISSION_STARTED", (e) => received.push(e));

    legionEventBus.emit(missionStarted());

    expect(received).toHaveLength(1);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("caps in-memory history at 500 entries", () => {
    for (let i = 0; i < 550; i++) {
      legionEventBus.emit(missionStarted());
    }
    expect(legionEventBus.getHistory()).toHaveLength(500);
  });

  it("assigns unique ids and strictly increasing seq numbers, even for events emitted back-to-back", () => {
    for (let i = 0; i < 50; i++) {
      legionEventBus.emit(missionStarted());
    }

    const history = legionEventBus.getHistory(); // newest first
    const ids = new Set(history.map((e) => e.id));
    expect(ids.size).toBe(history.length);

    const seqsAscending = [...history].reverse().map((e) => e.seq);
    for (let i = 1; i < seqsAscending.length; i++) {
      expect(seqsAscending[i]).toBeGreaterThan(seqsAscending[i - 1]);
    }
  });
});
