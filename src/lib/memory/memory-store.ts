// LEGION Phase 09 — In-Memory Mission Memory Store Implementation
// Provides mission-scoped, concurrency-safe, sanitized shared context storage

import {
  MemoryImportance,
  MemoryQueryFilter,
  MissionMemoryEntry,
  MissionMemorySnapshot,
  MissionMemoryStore,
} from "./types";
import { sanitizeMemoryContent, sanitizeMemoryMetadata } from "./sanitizer";
import { legionEventBus } from "../events/bus";

const IMPORTANCE_WEIGHTS: Record<MemoryImportance, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export class InMemoryMissionMemoryStore implements MissionMemoryStore {
  // Map of missionId -> entries
  private storage = new Map<string, MissionMemoryEntry[]>();
  private globalSeq = 0;

  /**
   * Appends a new memory entry with automated security sanitization and thread safety
   */
  async append(
    entry: Omit<MissionMemoryEntry, "id" | "createdAt">
  ): Promise<MissionMemoryEntry> {
    this.globalSeq++;
    const seq = this.globalSeq;
    const id = `mem_${Date.now()}_${seq}_${Math.random().toString(36).slice(2, 7)}`;
    const createdAt = new Date().toISOString();

    const sanitizedEntry: MissionMemoryEntry = {
      id,
      missionId: entry.missionId,
      taskId: entry.taskId,
      agentRole: entry.agentRole,
      type: entry.type,
      title: sanitizeMemoryContent(entry.title),
      content: sanitizeMemoryContent(entry.content),
      tags: (entry.tags || []).map((t) => sanitizeMemoryContent(t)),
      importance: entry.importance || "MEDIUM",
      createdAt,
      metadata: sanitizeMemoryMetadata(entry.metadata),
    };

    if (!this.storage.has(entry.missionId)) {
      this.storage.set(entry.missionId, []);
    }

    const missionEntries = this.storage.get(entry.missionId)!;
    missionEntries.push(sanitizedEntry);

    // Emit typed memory event
    try {
      legionEventBus.emit({
        missionId: entry.missionId,
        type: "MEMORY_ENTRY_ADDED" as any,
        message: `MEMORY: Added [${sanitizedEntry.type}] (${sanitizedEntry.importance}) "${sanitizedEntry.title}" by ${sanitizedEntry.agentRole}`,
        data: {
          id: sanitizedEntry.id,
          taskId: sanitizedEntry.taskId,
          entryType: sanitizedEntry.type,
          importance: sanitizedEntry.importance,
          entryCount: missionEntries.length,
          title: sanitizedEntry.title,
        },
      });
    } catch {
      // Ignored
    }

    return sanitizedEntry;
  }

  /**
   * Retrieves a single entry by ID across storage
   */
  async get(id: string): Promise<MissionMemoryEntry | null> {
    for (const entries of this.storage.values()) {
      const match = entries.find((e) => e.id === id);
      if (match) return match;
    }
    return null;
  }

  /**
   * Queries memory entries filtered strictly by missionId and criteria
   */
  async query(filter: MemoryQueryFilter): Promise<MissionMemoryEntry[]> {
    const missionEntries = this.storage.get(filter.missionId) || [];

    let results = [...missionEntries];

    if (filter.taskId) {
      results = results.filter((e) => e.taskId === filter.taskId);
    }

    if (filter.agentRole) {
      results = results.filter((e) => e.agentRole === filter.agentRole);
    }

    if (filter.types && filter.types.length > 0) {
      const typeSet = new Set(filter.types);
      results = results.filter((e) => typeSet.has(e.type));
    }

    if (filter.tags && filter.tags.length > 0) {
      results = results.filter((e) =>
        filter.tags!.some((tag) => e.tags.includes(tag))
      );
    }

    if (filter.minImportance) {
      const minWeight = IMPORTANCE_WEIGHTS[filter.minImportance] || 1;
      results = results.filter(
        (e) => (IMPORTANCE_WEIGHTS[e.importance] || 2) >= minWeight
      );
    }

    if (typeof filter.limit === "number" && filter.limit > 0) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  /**
   * Returns all memory entries for a mission in chronological order
   */
  async getAllForMission(missionId: string): Promise<MissionMemoryEntry[]> {
    return [...(this.storage.get(missionId) || [])];
  }

  /**
   * Builds an aggregated structured snapshot of a mission's memory
   */
  async snapshot(missionId: string): Promise<MissionMemorySnapshot> {
    const entries = this.storage.get(missionId) || [];

    const requirements = entries.filter((e) => e.type === "MISSION_REQUIREMENT");
    const architecturalDecisions = entries.filter(
      (e) => e.type === "ARCHITECTURE_DECISION" || e.type === "INTERFACE_CONTRACT"
    );
    const implementationSummary = entries.filter(
      (e) => e.type === "IMPLEMENTATION_CHANGE" || e.type === "TASK_RESULT"
    );
    const issues = entries.filter((e) => e.type === "ISSUE");
    const sentinelFindings = entries.filter(
      (e) => e.type === "SENTINEL_FINDING" || e.type === "LESSON"
    );
    const artifacts = entries.filter((e) => e.type === "ARTIFACT");

    const snapshot: MissionMemorySnapshot = {
      missionId,
      totalEntries: entries.length,
      requirements,
      architecturalDecisions,
      implementationSummary,
      issues,
      sentinelFindings,
      artifacts,
      createdAt: new Date().toISOString(),
    };

    try {
      legionEventBus.emit({
        missionId,
        type: "MEMORY_SNAPSHOT_CREATED" as any,
        message: `MEMORY: Created snapshot with ${entries.length} structured entries for mission "${missionId}".`,
        data: {
          missionId,
          totalEntries: entries.length,
          requirementsCount: requirements.length,
          archDecisionsCount: architecturalDecisions.length,
          implementationCount: implementationSummary.length,
          issuesCount: issues.length,
          sentinelFindingsCount: sentinelFindings.length,
        },
      });
    } catch {
      // Ignored
    }

    return snapshot;
  }

  /**
   * Clears memory entries for a specific mission
   */
  async clear(missionId: string): Promise<void> {
    this.storage.delete(missionId);
  }
}
