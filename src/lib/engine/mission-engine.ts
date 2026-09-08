// Shared contract that any mission engine (Demo or Real) must satisfy.
// The UI and Zustand stores depend only on this shape, never on a concrete engine class.

export interface MissionEngineStatus {
  missionId: string;
  isRunning: boolean;
  isPaused: boolean;
  stepIndex?: number;
}

export interface MissionEngine {
  start(): void;
  pause(): void;
  resume(): void;
  stop(): void;
  getStatus(): MissionEngineStatus;
}
