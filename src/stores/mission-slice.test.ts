import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { legionEventBus } from "@/lib/events/bus";
import { ApprovalEventPayload } from "@/types/events";
import { useMissionSlice } from "./mission-slice";

type ApprovalEvent = ApprovalEventPayload;

// See tasks-slice.test.ts for why initialize() runs once in beforeAll rather
// than per-test.
describe("mission-slice respondToApproval", () => {
  beforeAll(() => {
    useMissionSlice.getState().initialize();
  });

  beforeEach(() => {
    useMissionSlice.setState({
      approvals: [
        {
          id: "APP-A",
          missionId: "mission-001",
          requestedByRole: "COMMANDER",
          actionTitle: "Run production database migration",
          description: "Apply schema migration.",
          risk: "HIGH",
          reason: "Schema changes detected.",
          status: "PENDING",
          requestedAt: new Date().toISOString(),
        },
        {
          id: "APP-B",
          missionId: "mission-001",
          requestedByRole: "ARCHITECT",
          actionTitle: "Deploy staging preview",
          description: "Push preview build.",
          risk: "LOW",
          reason: "Routine preview deploy.",
          status: "PENDING",
          requestedAt: new Date().toISOString(),
        },
      ],
    });
  });

  it("emits the responded approval's own actionTitle/risk, not another pending approval's", () => {
    const emitted: ApprovalEvent[] = [];
    const unsubscribe = legionEventBus.subscribe<ApprovalEvent>("APPROVAL_GRANTED", (e) => emitted.push(e));

    useMissionSlice.getState().respondToApproval("APP-B", true, "looks fine");

    expect(emitted).toHaveLength(1);
    expect(emitted[0].actionTitle).toBe("Deploy staging preview");
    expect(emitted[0].risk).toBe("LOW");

    unsubscribe();
  });

  it("marks only the targeted approval as APPROVED/REJECTED", () => {
    useMissionSlice.getState().respondToApproval("APP-A", false, "not now");

    const approvals = useMissionSlice.getState().approvals;
    expect(approvals.find((a) => a.id === "APP-A")?.status).toBe("REJECTED");
    expect(approvals.find((a) => a.id === "APP-B")?.status).toBe("PENDING");
  });

  it("falls back gracefully for an unknown approval id instead of fabricating data", () => {
    const emitted: ApprovalEvent[] = [];
    const unsubscribe = legionEventBus.subscribe<ApprovalEvent>("APPROVAL_REJECTED", (e) => emitted.push(e));

    useMissionSlice.getState().respondToApproval("APP-DOES-NOT-EXIST", false);

    expect(emitted).toHaveLength(1);
    expect(emitted[0].actionTitle).toBe("Unknown action");

    unsubscribe();
  });
});
