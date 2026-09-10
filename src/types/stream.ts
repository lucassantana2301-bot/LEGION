// LEGION Mission Runtime API & NDJSON Streaming Contracts

import { LegionEventType } from "./events";
import { OrchestratorResult } from "@/lib/agent/orchestrator";

export interface MissionStreamRequest {
  missionId?: string;
  mission: string;
  projectContext?: string;
  maxAttemptsPerTask?: number;
  maxConcurrentTasks?: number;
  failurePolicy?: "FAIL_FAST" | "CONTINUE_INDEPENDENT";
  timeoutMs?: number;
}

export interface MissionStreamEventEnvelope {
  id?: string;
  type: LegionEventType | "PLAN_READY" | "MISSION_CANCELLED" | "STREAM_END" | "ERROR";
  missionId: string;
  taskId?: string;
  agentRole?: string;
  slotId?: number | string;
  activeTaskCount?: number;
  concurrencyLimit?: number;
  timestamp: string;
  seq: number;
  message?: string;
  data?: Record<string, unknown>;
  result?: OrchestratorResult;
  error?: string;
}
