// Root Store & Hook Re-exports

import { useEffect } from "react";
import { useMissionSlice } from "./mission-slice";
import { useAgentsSlice } from "./agents-slice";
import { useTasksSlice } from "./tasks-slice";
import { useActivitySlice } from "./activity-slice";
import { useTerminalSlice } from "./terminal-slice";

export * from "./mission-slice";
export * from "./agents-slice";
export * from "./tasks-slice";
export * from "./activity-slice";
export * from "./terminal-slice";

/**
 * Convenience hook that connects all slices and subscribes them to the Event Bus
 */
export function useMissionStore() {
  const missionSlice = useMissionSlice();
  const agentsSlice = useAgentsSlice();
  const tasksSlice = useTasksSlice();
  const activitySlice = useActivitySlice();
  const terminalSlice = useTerminalSlice();

  useEffect(() => {
    missionSlice.initialize();
    agentsSlice.initialize();
    tasksSlice.initialize();
    activitySlice.initialize();
    terminalSlice.initialize();
  }, [missionSlice, agentsSlice, tasksSlice, activitySlice, terminalSlice]);

  return {
    ...missionSlice,
    ...agentsSlice,
    ...tasksSlice,
    ...activitySlice,
    ...terminalSlice,
  };
}
