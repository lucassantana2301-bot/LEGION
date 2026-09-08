// LEGION Domain Models — Phase 01

export type MissionStatus =
  | "DRAFT"
  | "PLANNING"
  | "RUNNING"
  | "PAUSED"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type TaskStatus =
  | "BACKLOG"
  | "READY"
  | "IN_PROGRESS"
  | "REVIEW"
  | "FAILED"
  | "COMPLETED"
  | "BLOCKED";

export type AgentStatus =
  | "IDLE"
  | "THINKING"
  | "WORKING"
  | "WAITING"
  | "ERROR"
  | "OFFLINE";

export type AgentRole = "COMMANDER" | "ARCHITECT" | "BUILDER" | "SENTINEL";

export type IssueStatus = "OPEN" | "FIXING" | "RETESTING" | "RESOLVED";

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string;
  repositoryUrl?: string;
  framework: string;
  database: string;
  missionCount: number;
  lastExecutionAt?: string;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
}

export interface Mission {
  id: string;
  projectId: string;
  workspaceId: string;
  title: string;
  prompt: string;
  brief: {
    requirements: string[];
    constraints: string[];
    context: string;
  };
  plan: {
    id: string;
    step: number;
    title: string;
    description: string;
    assignedAgent: AgentRole;
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  }[];
  status: MissionStatus;
  progressPercent: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  openIssuesCount: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  tokensUsed: number;
  estimatedCostUsd: number;
  maxIterations: number;
  maxCostUsd: number;
  createdAt: string;
}

export interface Agent {
  id: string;
  role: AgentRole;
  name: string;
  tagline: string;
  description: string;
  status: AgentStatus;
  currentTaskTitle?: string;
  currentTaskId?: string;
  capabilities: string[];
  metrics: {
    completedTasks: number;
    failedValidations: number;
    averageRuntimeMs: number;
    issuesDiscovered: number;
    tokensConsumed: number;
  };
  limits: {
    maxRetries: number;
    tokenBudget: number;
    maxIterations: number;
  };
}

export interface AgentRun {
  id: string;
  missionId: string;
  agentRole: AgentRole;
  taskId?: string;
  status: AgentStatus;
  startedAt: string;
  endedAt?: string;
  inputPrompt?: string;
  outputSummary?: string;
  tokensUsed: number;
}

export interface Task {
  id: string;
  missionId: string;
  order: number;
  title: string;
  description: string;
  assignedRole: AgentRole;
  status: TaskStatus;
  priority: Severity;
  dependencies: string[]; // Task IDs
  attempts: number;
  maxAttempts: number;
  acceptanceCriteria: string[];
  affectedFiles: string[];
  testIds: string[];
  issueIds: string[];
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDependency {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
}

export interface Issue {
  id: string;
  missionId: string;
  taskId: string;
  title: string;
  description: string;
  severity: Severity;
  status: IssueStatus;
  reportedByRole: AgentRole; // typically SENTINEL
  assignedToRole: AgentRole; // typically BUILDER
  stackTrace?: string;
  affectedFile?: string;
  proposedFix?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface TestRun {
  id: string;
  missionId: string;
  taskId: string;
  agentRole: AgentRole;
  suiteName: string;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  durationMs: number;
  logs: string[];
  status: "PASSED" | "FAILED";
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  missionId: string;
  timestamp: string;
  type: string;
  agentRole?: AgentRole;
  targetRole?: AgentRole;
  taskId?: string;
  title: string;
  message: string;
  severity?: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  metadata?: Record<string, unknown>;
}

export interface Artifact {
  id: string;
  missionId: string;
  taskId?: string;
  path: string;
  type: "CODE" | "SCHEMA" | "DOC" | "CONFIG" | "TEST";
  status: "CREATED" | "MODIFIED" | "DELETED";
  agentRole: AgentRole;
  linesCount: number;
  updatedAt: string;
}

export interface Approval {
  id: string;
  missionId: string;
  requestedByRole: AgentRole;
  actionTitle: string;
  description: string;
  risk: Severity;
  reason: string;
  status: ApprovalStatus;
  requestedAt: string;
  respondedAt?: string;
  responseNote?: string;
}

export interface TerminalLogLine {
  id: string;
  timestamp: string;
  stream: "COMMAND" | "STDOUT" | "STDERR" | "SYSTEM" | "SUCCESS" | "WARNING";
  text: string;
}
