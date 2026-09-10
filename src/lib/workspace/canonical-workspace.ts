// LEGION Phase 09.9 — Canonical Workspace Implementation
// Manages the canonical single-source-of-truth project state, snapshot generation, conflict detection, deterministic digest, and atomic patch integration.

import crypto from "crypto";
import {
  CanonicalWorkspace,
  IntegrationConflict,
  IntegrationResult,
  PatchFileChange,
  ProjectBaseline,
  TaskPatch,
  TaskWorkspaceSnapshot,
  WorkspaceFile,
} from "./types";
import { legionEventBus } from "../events/bus";

/**
 * Normalizes a workspace file path, resolving ./ and ../ segments.
 * Strictly throws if the path escapes the logical workspace root (e.g. "../foo").
 */
export function normalizeWorkspacePath(rawPath: string): string {
  if (!rawPath || typeof rawPath !== "string") return "";

  if (rawPath.includes("\0")) {
    throw new Error(`PATH_TRAVERSAL_REJECTED: Path contains invalid null bytes: "${rawPath}"`);
  }

  const normalized = rawPath.replace(/\\/g, "/");
  const segments: string[] = [];

  for (const segment of normalized.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) {
        throw new Error(`PATH_TRAVERSAL_REJECTED: Path "${rawPath}" escapes workspace root.`);
      }
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  return segments.join("/");
}

export class InMemoryCanonicalWorkspace implements CanonicalWorkspace {
  private missionId: string;
  private currentRevision = 0;
  private generationId: string;
  private frozen = false;
  private baseline: ProjectBaseline | null = null;
  private files = new Map<string, WorkspaceFile>();
  private appliedPatches: TaskPatch[] = [];
  private deletedFilesMap = new Map<string, { deletedRevision: number; deletedTaskId: string }>();

  constructor(missionId: string = "default", initialFiles?: Record<string, string> | ProjectBaseline) {
    this.missionId = missionId;
    this.generationId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    if (initialFiles) {
      if ("files" in initialFiles && typeof initialFiles.files === "object") {
        this.setBaseline(initialFiles as ProjectBaseline);
      } else {
        const rawFiles = initialFiles as Record<string, string>;
        this.setBaseline({
          missionId,
          revision: 0,
          files: { ...rawFiles },
        });
      }
    }
  }

  public getMissionId(): string {
    return this.missionId;
  }

  public getCurrentRevision(): number {
    return this.currentRevision;
  }

  public getGenerationId(): string {
    return this.generationId;
  }

  /**
   * Deterministic SHA-256 digest of all files currently in the canonical workspace
   */
  public getWorkspaceDigest(): string {
    const sortedKeys = Array.from(this.files.keys()).sort();
    const hash = crypto.createHash("sha256");
    for (const key of sortedKeys) {
      const file = this.files.get(key)!;
      hash.update(`${key}:${crypto.createHash("sha256").update(file.content).digest("hex")}\n`);
    }
    return hash.digest("hex");
  }

  public freeze(): void {
    this.frozen = true;
  }

  public isFrozen(): boolean {
    return this.frozen;
  }

  public getBaseline(): ProjectBaseline | null {
    if (!this.baseline) return null;
    return {
      missionId: this.baseline.missionId,
      revision: this.baseline.revision,
      files: { ...this.baseline.files },
      metadata: this.baseline.metadata
        ? JSON.parse(JSON.stringify(this.baseline.metadata))
        : undefined,
    };
  }

  public setBaseline(baseline: ProjectBaseline): void {
    if (this.frozen) {
      throw new Error("WORKSPACE_FROZEN: Cannot set baseline on frozen canonical workspace.");
    }

    if (baseline.missionId) {
      this.missionId = baseline.missionId;
    }

    this.generationId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const normalizedFiles: Record<string, string> = {};
    for (const [rawPath, content] of Object.entries(baseline.files || {})) {
      normalizedFiles[normalizeWorkspacePath(rawPath)] = content;
    }

    this.baseline = {
      missionId: this.missionId,
      revision: baseline.revision ?? 0,
      files: normalizedFiles,
      metadata: baseline.metadata
        ? JSON.parse(JSON.stringify(baseline.metadata))
        : undefined,
    };

    this.currentRevision = baseline.revision ?? 0;
    this.files.clear();
    this.appliedPatches = [];
    this.deletedFilesMap.clear();

    for (const [normPath, content] of Object.entries(normalizedFiles)) {
      this.files.set(normPath, {
        path: normPath,
        content,
        lastModifiedRevision: this.currentRevision,
        lastModifiedTaskId: "baseline",
      });
    }
  }

  /**
   * Creates an immutable baseline snapshot of the canonical workspace for an agent task
   */
  public createSnapshot(taskId: string): TaskWorkspaceSnapshot {
    const fileSnapshot: Record<string, string> = {};
    for (const [path, file] of this.files.entries()) {
      fileSnapshot[path] = file.content;
    }

    return {
      missionId: this.missionId,
      generationId: this.generationId,
      taskId,
      baseRevision: this.currentRevision,
      files: fileSnapshot,
      createdAt: new Date().toISOString(),
    };
  }

  public getFile(path: string): WorkspaceFile | null {
    const normalized = normalizeWorkspacePath(path);
    const f = this.files.get(normalized);
    return f ? { ...f } : null;
  }

  public getAllFiles(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [path, file] of this.files.entries()) {
      result[path] = file.content;
    }
    return result;
  }

  /**
   * Detects whether applying this patch would cause conflicts against the current canonical workspace
   */
  public detectConflicts(patch: TaskPatch): IntegrationConflict[] {
    const conflicts: IntegrationConflict[] = [];

    // 0. Mission ID and Generation ID check
    if (patch.missionId) {
      if (this.missionId === "default") {
        this.missionId = patch.missionId;
      } else if (patch.missionId !== this.missionId) {
        conflicts.push({
          path: "*",
          type: "INVALID_MISSION_PATCH",
          baseRevision: patch.baseRevision,
          currentRevision: this.currentRevision,
          lastModifiedTaskId: "orchestrator",
          details: `Patch missionId "${patch.missionId}" does not match workspace missionId "${this.missionId}".`,
        });
        return conflicts;
      }
    }

    if (patch.generationId && patch.generationId !== this.generationId) {
      conflicts.push({
        path: "*",
        type: "STALE_GENERATION_PATCH",
        baseRevision: patch.baseRevision,
        currentRevision: this.currentRevision,
        lastModifiedTaskId: "orchestrator",
        details: `Patch generationId "${patch.generationId}" does not match workspace generationId "${this.generationId}".`,
      });
      return conflicts;
    }

    for (const change of patch.files) {
      const normPath = normalizeWorkspacePath(change.path);
      const canonicalFile = this.files.get(normPath);

      // 1. Stale base revision modification check on active file
      if (canonicalFile && canonicalFile.lastModifiedRevision > patch.baseRevision) {
        if (change.type === "MODIFIED" || change.type === "ADDED") {
          if (change.previousContent !== undefined && change.previousContent !== canonicalFile.content) {
            conflicts.push({
              path: normPath,
              type: "CONCURRENT_MODIFICATION",
              baseRevision: patch.baseRevision,
              currentRevision: this.currentRevision,
              lastModifiedTaskId: canonicalFile.lastModifiedTaskId,
              details: `File "${normPath}" was modified in canonical workspace at revision ${canonicalFile.lastModifiedRevision} by task "${canonicalFile.lastModifiedTaskId}".`,
            });
          } else if (change.previousContent === undefined) {
            conflicts.push({
              path: normPath,
              type: "STALE_BASE_MODIFIED",
              baseRevision: patch.baseRevision,
              currentRevision: this.currentRevision,
              lastModifiedTaskId: canonicalFile.lastModifiedTaskId,
              details: `File "${normPath}" has progressed to revision ${canonicalFile.lastModifiedRevision} since task baseRevision ${patch.baseRevision}.`,
            });
          }
        } else if (change.type === "DELETED") {
          conflicts.push({
            path: normPath,
            type: "DELETE_CONFLICT",
            baseRevision: patch.baseRevision,
            currentRevision: this.currentRevision,
            lastModifiedTaskId: canonicalFile.lastModifiedTaskId,
            details: `Task attempted to delete "${normPath}" which was concurrently updated by task "${canonicalFile.lastModifiedTaskId}".`,
          });
        }
      }

      // 2. Stale modification on file that was already deleted in a later revision
      if (!canonicalFile && this.deletedFilesMap.has(normPath)) {
        const delInfo = this.deletedFilesMap.get(normPath)!;
        if (delInfo.deletedRevision > patch.baseRevision && (change.type === "MODIFIED" || change.type === "ADDED")) {
          conflicts.push({
            path: normPath,
            type: "STALE_DELETE_MODIFICATION",
            baseRevision: patch.baseRevision,
            currentRevision: this.currentRevision,
            lastModifiedTaskId: delInfo.deletedTaskId,
            details: `File "${normPath}" was deleted at revision ${delInfo.deletedRevision} by task "${delInfo.deletedTaskId}" and cannot be modified by stale patch based on revision ${patch.baseRevision}.`,
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Atomically integrates a TaskPatch into the canonical workspace
   */
  public integratePatch(patch: TaskPatch): IntegrationResult {
    if (this.frozen) {
      return {
        success: false,
        revision: this.currentRevision,
        appliedPatchId: patch.id,
        filesChanged: [],
        error: "WORKSPACE_FROZEN: Cannot integrate patch into frozen canonical workspace.",
      };
    }

    // 1. Conflict detection pre-flight
    const conflicts = this.detectConflicts(patch);
    if (conflicts.length > 0) {
      return {
        success: false,
        revision: this.currentRevision,
        appliedPatchId: patch.id,
        filesChanged: [],
        conflicts,
        error: `CONFLICT_DETECTED: Found ${conflicts.length} conflict(s) across canonical files.`,
      };
    }

    // 2. Atomic Application
    const nextRevision = this.currentRevision + 1;
    const changedPaths: string[] = [];

    for (const change of patch.files) {
      const normPath = normalizeWorkspacePath(change.path);
      if (change.type === "ADDED" || change.type === "MODIFIED") {
        this.files.set(normPath, {
          path: normPath,
          content: change.content || "",
          lastModifiedRevision: nextRevision,
          lastModifiedTaskId: patch.taskId,
        });
        this.deletedFilesMap.delete(normPath);
        changedPaths.push(normPath);
      } else if (change.type === "DELETED") {
        this.files.delete(normPath);
        this.deletedFilesMap.set(normPath, {
          deletedRevision: nextRevision,
          deletedTaskId: patch.taskId,
        });
        changedPaths.push(normPath);
      }
    }

    this.currentRevision = nextRevision;
    this.appliedPatches.push({
      ...patch,
      files: patch.files.map((f) => ({ ...f, path: normalizeWorkspacePath(f.path) })),
    });

    try {
      legionEventBus.emit({
        missionId: this.missionId,
        type: "FILE_MODIFIED" as any,
        message: `WORKSPACE: Integrated patch "${patch.id}" from task "${patch.taskId}" into canonical revision ${nextRevision} (${changedPaths.length} files).`,
        data: {
          taskId: patch.taskId,
          revision: nextRevision,
          filesChanged: changedPaths,
        },
      } as any);
    } catch {
      // safe fallback
    }

    return {
      success: true,
      revision: nextRevision,
      appliedPatchId: patch.id,
      filesChanged: changedPaths,
    };
  }

  /**
   * Overwrite or seed canonical files directly
   */
  public applyFiles(files: Record<string, string>, taskId: string): number {
    if (this.frozen) {
      throw new Error("WORKSPACE_FROZEN: Cannot apply files to frozen canonical workspace.");
    }

    this.currentRevision++;
    for (const [path, content] of Object.entries(files)) {
      const normPath = normalizeWorkspacePath(path);
      this.files.set(normPath, {
        path: normPath,
        content,
        lastModifiedRevision: this.currentRevision,
        lastModifiedTaskId: taskId,
      });
      this.deletedFilesMap.delete(normPath);
    }
    return this.currentRevision;
  }

  public getPatchHistory(): TaskPatch[] {
    return this.appliedPatches.map((patch) => ({
      ...patch,
      files: patch.files.map((f) => ({ ...f })),
    }));
  }

  public reset(): void {
    if (this.frozen) {
      throw new Error("WORKSPACE_FROZEN: Cannot reset a frozen canonical workspace during active mission lifecycle.");
    }
    this.files.clear();
    this.appliedPatches = [];
    this.deletedFilesMap.clear();
    this.baseline = null;
    this.currentRevision = 0;
    this.generationId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.frozen = false;
  }

  public startNewGeneration(missionId?: string, baseline?: ProjectBaseline): void {
    this.frozen = false;
    this.files.clear();
    this.appliedPatches = [];
    this.deletedFilesMap.clear();
    this.baseline = null;
    this.currentRevision = 0;
    this.generationId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    if (missionId) this.missionId = missionId;
    if (baseline) this.setBaseline(baseline);
  }
}
