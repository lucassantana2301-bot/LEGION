// LEGION Phase 09.7 — Canonical Workspace & Real Integrated Project Verification Contracts

export type PatchFileChangeType = "ADDED" | "MODIFIED" | "DELETED";

export interface PatchFileChange {
  path: string;
  type: PatchFileChangeType;
  content?: string;
  previousContent?: string;
}

export interface TaskPatch {
  id: string;
  taskId: string;
  missionId: string;
  generationId?: string;
  baseRevision: number;
  files: PatchFileChange[];
  createdAt: string;
  authorRole: string;
  summary?: string;
}

export interface WorkspaceFile {
  path: string;
  content: string;
  lastModifiedRevision: number;
  lastModifiedTaskId: string;
}

export interface ProjectBaseline {
  missionId: string;
  revision: number;
  files: Record<string, string>; // path -> content
  metadata?: {
    packageJson?: Record<string, unknown>;
    hasTsConfig?: boolean;
    framework?: string;
    createdAt?: string;
  };
}

export interface TaskWorkspaceSnapshot {
  missionId: string;
  generationId?: string;
  taskId: string;
  baseRevision: number;
  files: Record<string, string>; // path -> content
  createdAt: string;
}

export interface IntegrationConflict {
  path: string;
  type: "CONCURRENT_MODIFICATION" | "STALE_BASE_MODIFIED" | "DELETE_CONFLICT" | "STALE_DELETE_MODIFICATION" | "STALE_GENERATION_PATCH" | "INVALID_MISSION_PATCH";
  baseRevision: number;
  currentRevision: number;
  lastModifiedTaskId: string;
  details: string;
}

export interface IntegrationResult {
  success: boolean;
  revision: number;
  appliedPatchId: string;
  filesChanged: string[];
  conflicts?: IntegrationConflict[];
  error?: string;
}

export interface MaterializationReport {
  totalFilesWritten: number;
  files: string[];
  deletedFiles: string[];
  durationMs: number;
  sandboxId: string;
  remoteWorkspaceDigest?: string;
  canonicalWorkspaceDigest?: string;
}

export interface CanonicalWorkspace {
  getMissionId(): string;
  getCurrentRevision(): number;
  getGenerationId(): string;
  getWorkspaceDigest(): string;
  freeze(): void;
  isFrozen(): boolean;
  getBaseline(): ProjectBaseline | null;
  setBaseline(baseline: ProjectBaseline): void;
  startNewGeneration(missionId?: string, baseline?: ProjectBaseline): void;
  createSnapshot(taskId: string): TaskWorkspaceSnapshot;
  getFile(path: string): WorkspaceFile | null;
  getAllFiles(): Record<string, string>;
  detectConflicts(patch: TaskPatch): IntegrationConflict[];
  integratePatch(patch: TaskPatch): IntegrationResult;
  applyFiles(files: Record<string, string>, taskId: string): number;
  getPatchHistory(): TaskPatch[];
  reset(): void;
}


