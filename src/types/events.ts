// LEGION Event System — Typed Event Definitions

import { AgentRole, AgentStatus, IssueStatus, Severity, TaskStatus } from "./domain";

export type LegionEventType =
  // Mission Lifecycle
  | "MISSION_CREATED"
  | "MISSION_PLANNING"
  | "MISSION_STARTED"
  | "MISSION_PAUSED"
  | "MISSION_RESUMED"
  | "MISSION_COMPLETED"
  | "MISSION_FAILED"
  // Agent Lifecycle & Thought
  | "AGENT_STARTED"
  | "AGENT_THINKING"
  | "AGENT_WORKING"
  | "AGENT_WAITING"
  | "AGENT_COMPLETED"
  | "AGENT_FAILED"
  | "AGENT_COMMUNICATION"
  // Task Flow
  | "TASK_CREATED"
  | "TASK_ASSIGNED"
  | "TASK_STARTED"
  | "TASK_REVIEW"
  | "TASK_COMPLETED"
  | "TASK_FAILED"
  | "TASK_BLOCKED"
  // File System
  | "FILE_CREATED"
  | "FILE_MODIFIED"
  | "FILE_DELETED"
  // Testing & QA
  | "TEST_STARTED"
  | "TEST_PASSED"
  | "TEST_FAILED"
  // Issues & Bug Triage
  | "ISSUE_CREATED"
  | "ISSUE_ASSIGNED"
  | "ISSUE_RESOLVED"
  // Build & Pipeline
  | "BUILD_STARTED"
  | "BUILD_COMPLETED"
  | "BUILD_FAILED"
  // Human in the Loop
  | "APPROVAL_REQUIRED"
  | "APPROVAL_GRANTED"
  | "APPROVAL_REJECTED"
  // Terminal / Logs
  | "TERMINAL_OUTPUT";

export interface BaseEventPayload {
  id: string;
  missionId: string;
  timestamp: string;
  seq: number;
  type: LegionEventType;
}

export interface MissionEventPayload extends BaseEventPayload {
  type:
    | "MISSION_CREATED"
    | "MISSION_PLANNING"
    | "MISSION_STARTED"
    | "MISSION_PAUSED"
    | "MISSION_RESUMED"
    | "MISSION_COMPLETED"
    | "MISSION_FAILED";
  title: string;
  progressPercent?: number;
  message: string;
}

export interface AgentEventPayload extends BaseEventPayload {
  type:
    | "AGENT_STARTED"
    | "AGENT_THINKING"
    | "AGENT_WORKING"
    | "AGENT_WAITING"
    | "AGENT_COMPLETED"
    | "AGENT_FAILED"
    | "AGENT_COMMUNICATION";
  role: AgentRole;
  targetRole?: AgentRole;
  status: AgentStatus;
  currentTaskTitle?: string;
  message: string;
  tokensUsed?: number;
}

export interface TaskEventPayload extends BaseEventPayload {
  type:
    | "TASK_CREATED"
    | "TASK_ASSIGNED"
    | "TASK_STARTED"
    | "TASK_REVIEW"
    | "TASK_COMPLETED"
    | "TASK_FAILED"
    | "TASK_BLOCKED";
  taskId: string;
  taskTitle: string;
  assignedRole: AgentRole;
  status: TaskStatus;
  priority: Severity;
  message: string;
}

export interface FileEventPayload extends BaseEventPayload {
  type: "FILE_CREATED" | "FILE_MODIFIED" | "FILE_DELETED";
  path: string;
  agentRole: AgentRole;
  linesCount?: number;
  message: string;
}

export interface TestEventPayload extends BaseEventPayload {
  type: "TEST_STARTED" | "TEST_PASSED" | "TEST_FAILED";
  taskId: string;
  suiteName: string;
  agentRole: AgentRole;
  passedCount?: number;
  failedCount?: number;
  errorSnippet?: string;
  message: string;
}

export interface IssueEventPayload extends BaseEventPayload {
  type: "ISSUE_CREATED" | "ISSUE_ASSIGNED" | "ISSUE_RESOLVED";
  issueId: string;
  taskId: string;
  title: string;
  severity: Severity;
  status: IssueStatus;
  reportedByRole: AgentRole;
  assignedToRole: AgentRole;
  message: string;
}

export interface BuildEventPayload extends BaseEventPayload {
  type: "BUILD_STARTED" | "BUILD_COMPLETED" | "BUILD_FAILED";
  environment: string;
  durationMs?: number;
  message: string;
}

export interface ApprovalEventPayload extends BaseEventPayload {
  type: "APPROVAL_REQUIRED" | "APPROVAL_GRANTED" | "APPROVAL_REJECTED";
  approvalId: string;
  actionTitle: string;
  risk: Severity;
  reason: string;
  message: string;
}

export interface TerminalEventPayload extends BaseEventPayload {
  type: "TERMINAL_OUTPUT";
  stream: "COMMAND" | "STDOUT" | "STDERR" | "SYSTEM" | "SUCCESS" | "WARNING";
  text: string;
}

export type LegionEvent =
  | MissionEventPayload
  | AgentEventPayload
  | TaskEventPayload
  | FileEventPayload
  | TestEventPayload
  | IssueEventPayload
  | BuildEventPayload
  | ApprovalEventPayload
  | TerminalEventPayload;
