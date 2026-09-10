// LEGION Phase 09 — Mission Memory & Shared Context Contracts

import { AgentRole, Severity } from "@/types/domain";

export type MissionMemoryType =
  | "MISSION_REQUIREMENT"
  | "COMMANDER_DECISION"
  | "ARCHITECTURE_DECISION"
  | "INTERFACE_CONTRACT"
  | "IMPLEMENTATION_CHANGE"
  | "ARTIFACT"
  | "SENTINEL_FINDING"
  | "ISSUE"
  | "TASK_RESULT"
  | "LESSON";

export type MemoryImportance = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface MissionMemoryEntry {
  id: string;
  missionId: string;
  taskId?: string;
  agentRole: AgentRole;
  type: MissionMemoryType;
  title: string;
  content: string;
  tags: string[];
  importance: MemoryImportance;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryQueryFilter {
  missionId: string;
  taskId?: string;
  agentRole?: AgentRole;
  types?: MissionMemoryType[];
  tags?: string[];
  minImportance?: MemoryImportance;
  limit?: number;
}

export interface ContextRetrievalOptions {
  missionId: string;
  taskId?: string;
  dependencies?: string[];
  assignedRole?: AgentRole;
  taskTitle?: string;
  taskDescription?: string;
  tags?: string[];
  maxEntries?: number;
  maxCharacters?: number;
}

export interface RetrievedContextResult {
  entries: MissionMemoryEntry[];
  formattedContext: string;
  totalEntriesFound: number;
  totalCharacters: number;
}

export interface MissionMemorySnapshot {
  missionId: string;
  totalEntries: number;
  requirements: MissionMemoryEntry[];
  architecturalDecisions: MissionMemoryEntry[];
  implementationSummary: MissionMemoryEntry[];
  issues: MissionMemoryEntry[];
  sentinelFindings: MissionMemoryEntry[];
  artifacts: MissionMemoryEntry[];
  createdAt: string;
}

export interface MissionMemoryStore {
  append(entry: Omit<MissionMemoryEntry, "id" | "createdAt">): Promise<MissionMemoryEntry>;
  get(id: string): Promise<MissionMemoryEntry | null>;
  query(filter: MemoryQueryFilter): Promise<MissionMemoryEntry[]>;
  getAllForMission(missionId: string): Promise<MissionMemoryEntry[]>;
  snapshot(missionId: string): Promise<MissionMemorySnapshot>;
  clear(missionId: string): Promise<void>;
}
