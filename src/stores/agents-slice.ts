// Agents State Slice

import { create } from "zustand";
import { Agent, AgentRole } from "@/types/domain";
import { LegionEvent } from "@/types/events";
import { legionEventBus } from "@/lib/events/bus";
import { INITIAL_AGENTS } from "@/lib/db/seed-data";

export interface AgentsSliceState {
  agents: Record<AgentRole, Agent>;
  initialize: () => void;
}

const createInitialAgentsMap = (): Record<AgentRole, Agent> => {
  return INITIAL_AGENTS.reduce((acc, agent) => {
    acc[agent.role] = {
      ...agent,
      status: "IDLE",
      currentTaskTitle: undefined,
    };
    return acc;
  }, {} as Record<AgentRole, Agent>);
};

export const useAgentsSlice = create<AgentsSliceState>((set) => {
  let isSubscribed = false;

  const handleEvent = (event: LegionEvent) => {
    switch (event.type) {
      case "AGENT_WORKING":
      case "AGENT_THINKING":
      case "AGENT_WAITING":
      case "AGENT_COMPLETED":
      case "AGENT_FAILED":
        set((s) => ({
          agents: {
            ...s.agents,
            [event.role]: {
              ...s.agents[event.role],
              status: event.status,
              currentTaskTitle: event.currentTaskTitle || s.agents[event.role]?.currentTaskTitle,
            },
          },
        }));
        break;
    }
  };

  return {
    agents: createInitialAgentsMap(),
    initialize: () => {
      if (!isSubscribed) {
        legionEventBus.subscribe("*", handleEvent);
        isSubscribed = true;
      }
    },
  };
});
