// Terminal & Stream Log State Slice

import { create } from "zustand";
import { TerminalLogLine } from "@/types/domain";
import { LegionEvent } from "@/types/events";
import { legionEventBus } from "@/lib/events/bus";

export interface TerminalSliceState {
  terminalLogs: TerminalLogLine[];
  clearTerminal: () => void;
  initialize: () => void;
}

export const useTerminalSlice = create<TerminalSliceState>((set) => {
  let isSubscribed = false;

  const handleEvent = (event: LegionEvent) => {
    if (event.type === "TERMINAL_OUTPUT") {
      set((s) => ({
        terminalLogs: [
          ...s.terminalLogs,
          {
            id: event.id,
            timestamp: event.timestamp,
            stream: event.stream,
            text: event.text,
          },
        ],
      }));
    }
  };

  return {
    terminalLogs: [
      { id: "t1", timestamp: "14:30:58", stream: "SYSTEM", text: "[LEGION V1] Core orchestrator initialized. 4 agents online." },
      { id: "t2", timestamp: "14:31:00", stream: "COMMAND", text: "> legion commander plan --mission=mission-001" },
      { id: "t3", timestamp: "14:32:10", stream: "STDOUT", text: "✓ Architecture synthesized: PostgreSQL + Next.js App Router" },
      { id: "t4", timestamp: "14:33:20", stream: "COMMAND", text: "> legion builder write --file=src/lib/auth.ts" },
      { id: "t5", timestamp: "14:35:08", stream: "STDERR", text: "✕ FAIL tests/auth.test.ts > Auth Flow > preserves redirect callbackUrl" },
      { id: "t6", timestamp: "14:35:12", stream: "WARNING", text: "! ISSUE-004 logged: High Severity. Re-routing to Builder." },
    ],
    clearTerminal: () => set({ terminalLogs: [] }),
    initialize: () => {
      if (!isSubscribed) {
        legionEventBus.subscribe("*", handleEvent);
        isSubscribed = true;
      }
    },
  };
});
