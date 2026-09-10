// LEGION Phase 09.5 — Real Execution Evidence Contracts

import { PatchFileChange, TaskPatch } from "../workspace/types";

export interface ExecutedCommandTelemetry {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs?: number;
  timestamp: string;
}

export interface ExecutionEvidence {
  commands: ExecutedCommandTelemetry[];
  stdout: string;
  stderr: string;
  exitCode: number;
  testResults?: Array<{ name: string; passed: boolean; output?: string }>;
  modifiedFiles: PatchFileChange[];
  patch?: TaskPatch;
  sandboxId: string;
  timestamps: {
    startedAt: string;
    completedAt: string;
  };
}
