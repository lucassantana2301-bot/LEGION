"use client";

import { useEffect } from "react";
import { useMissionSlice } from "@/stores/mission-slice";
import { useAgentsSlice } from "@/stores/agents-slice";
import { useTasksSlice } from "@/stores/tasks-slice";
import { useActivitySlice } from "@/stores/activity-slice";
import { useTerminalSlice } from "@/stores/terminal-slice";

/**
 * Wires every slice's event-bus subscription exactly once, without forcing
 * every consumer of the store to subscribe to all five slices (see
 * useMissionStore in stores/index.ts for the previous all-in-one hook).
 * Renders nothing — mount once near the root of the app.
 */
export const StoreBootstrap: React.FC = () => {
  const initializeMission = useMissionSlice((s) => s.initialize);
  const initializeAgents = useAgentsSlice((s) => s.initialize);
  const initializeTasks = useTasksSlice((s) => s.initialize);
  const initializeActivity = useActivitySlice((s) => s.initialize);
  const initializeTerminal = useTerminalSlice((s) => s.initialize);

  useEffect(() => {
    initializeMission();
    initializeAgents();
    initializeTasks();
    initializeActivity();
    initializeTerminal();
  }, [initializeMission, initializeAgents, initializeTasks, initializeActivity, initializeTerminal]);

  return null;
};
