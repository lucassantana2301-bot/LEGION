// Activity Feed and Graph State Slice

import { create } from "zustand";
import { ActivityEvent, AgentRole } from "@/types/domain";
import { LegionEvent } from "@/types/events";
import { legionEventBus } from "@/lib/events/bus";

export interface ActivitySliceState {
  activities: ActivityEvent[];
  activeCommunication: {
    from: AgentRole;
    to: AgentRole;
    timestamp: number;
  } | null;
  initialize: () => void;
}

export const DEMO_ACTIVITIES: ActivityEvent[] = [
  {
    id: "act-1",
    missionId: "mission-001",
    timestamp: "14:31:02",
    type: "MISSION_PLANNING",
    agentRole: "COMMANDER",
    title: "Mission analyzed",
    message: "Deconstructed requirements and created task execution graph.",
    severity: "INFO",
  },
  {
    id: "act-2",
    missionId: "mission-001",
    timestamp: "14:32:15",
    type: "AGENT_COMPLETED",
    agentRole: "ARCHITECT",
    title: "Architecture created",
    message: "Generated Drizzle schema, tech stack definition, and contracts.",
    severity: "SUCCESS",
  },
  {
    id: "act-3",
    missionId: "mission-001",
    timestamp: "14:33:40",
    type: "FILE_CREATED",
    agentRole: "BUILDER",
    title: "Project initialized",
    message: "Scaffolded Next.js App Router and authentication module.",
    severity: "INFO",
  },
  {
    id: "act-4",
    missionId: "mission-001",
    timestamp: "14:35:10",
    type: "TEST_FAILED",
    agentRole: "SENTINEL",
    title: "TEST FAILED",
    message: "Authentication redirect failed. ISSUE-004 created.",
    severity: "ERROR",
  },
];

export const useActivitySlice = create<ActivitySliceState>((set) => {
  let isSubscribed = false;

  const handleEvent = (event: LegionEvent) => {
    const nowIso = new Date().toISOString();
    let actSeverity: "INFO" | "SUCCESS" | "WARNING" | "ERROR" = "INFO";
    let actTitle = "Event";
    let actMessage = "";
    let role: AgentRole | undefined = undefined;

    if ("message" in event) {
      actMessage = event.message;
    }

    if (event.type.includes("FAIL") || event.type.includes("ERROR")) {
      actSeverity = "ERROR";
    } else if (event.type.includes("PASS") || event.type.includes("SUCCESS") || event.type.includes("COMPLETED")) {
      actSeverity = "SUCCESS";
    } else if (event.type.includes("WARNING") || event.type.includes("ISSUE") || event.type.includes("CANCELLED")) {
      actSeverity = "WARNING";
    }

    if (event.type === "AGENT_COMMUNICATION") {
      role = event.role;
      actTitle = `${event.role} → ${event.targetRole}`;
      set({
        activeCommunication: {
          from: event.role,
          to: event.targetRole || "BUILDER",
          timestamp: Date.now(),
        },
      });
    } else if ("role" in event && event.role) {
      role = event.role;
      actTitle = `${event.role}`;
    } else if ("agentRole" in event && event.agentRole) {
      role = event.agentRole;
      actTitle = `${event.agentRole}`;
    } else if (event.type.startsWith("SANDBOX_")) {
      actTitle = "SYSTEM // SANDBOX";
    } else if (event.type.startsWith("EXECUTION_")) {
      actTitle = "BUILDER // EXECUTION";
    }

    if (event.type === "TERMINAL_OUTPUT" || event.type === "EXECUTION_OUTPUT") {
      return; // Handled by terminal-slice
    }

    const activityEvent: ActivityEvent = {
      id: event.id || `act_${Date.now()}`,
      missionId: event.missionId,
      timestamp: event.timestamp || nowIso,
      type: event.type,
      agentRole: role,
      title: actTitle,
      message: actMessage || actTitle,
      severity: actSeverity,
    };

    set((s) => ({
      activities: [activityEvent, ...s.activities].slice(0, 80),
    }));
  };

  return {
    activities: [],
    activeCommunication: null,
    initialize: () => {
      if (!isSubscribed) {
        legionEventBus.subscribe("*", handleEvent);
        isSubscribed = true;
      }
    },
  };
});
