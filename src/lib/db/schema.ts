import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  uuid,
  pgEnum,
} from "drizzle-orm/pg-core";

// Enums
export const missionStatusEnum = pgEnum("mission_status", [
  "DRAFT",
  "PLANNING",
  "RUNNING",
  "PAUSED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "BACKLOG",
  "READY",
  "IN_PROGRESS",
  "REVIEW",
  "FAILED",
  "COMPLETED",
  "BLOCKED",
]);

export const agentStatusEnum = pgEnum("agent_status", [
  "IDLE",
  "THINKING",
  "WORKING",
  "WAITING",
  "ERROR",
  "OFFLINE",
]);

export const agentRoleEnum = pgEnum("agent_role", [
  "COMMANDER",
  "ARCHITECT",
  "BUILDER",
  "SENTINEL",
]);

export const issueStatusEnum = pgEnum("issue_status", [
  "OPEN",
  "FIXING",
  "RETESTING",
  "RESOLVED",
]);

export const severityEnum = pgEnum("severity", [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
]);

export const approvalStatusEnum = pgEnum("approval_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

// Tables
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerId: uuid("owner_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id).notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description").notNull(),
  repositoryUrl: text("repository_url"),
  framework: text("framework").default("Next.js").notNull(),
  database: text("database").default("PostgreSQL").notNull(),
  status: text("status").default("ACTIVE").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const missions = pgTable("missions", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id).notNull(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id).notNull(),
  title: text("title").notNull(),
  prompt: text("prompt").notNull(),
  brief: jsonb("brief").notNull(),
  plan: jsonb("plan").notNull(),
  status: missionStatusEnum("status").default("DRAFT").notNull(),
  progressPercent: integer("progress_percent").default(0).notNull(),
  totalTasks: integer("total_tasks").default(0).notNull(),
  completedTasks: integer("completed_tasks").default(0).notNull(),
  failedTasks: integer("failed_tasks").default(0).notNull(),
  openIssuesCount: integer("open_issues_count").default(0).notNull(),
  tokensUsed: integer("tokens_used").default(0).notNull(),
  estimatedCostUsd: text("estimated_cost_usd").default("0.00").notNull(),
  maxIterations: integer("max_iterations").default(50).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const agents = pgTable("agents", {
  id: text("id").primaryKey(), // e.g. "commander", "architect", "builder", "sentinel"
  role: agentRoleEnum("role").notNull(),
  name: text("name").notNull(),
  tagline: text("tagline").notNull(),
  description: text("description").notNull(),
  status: agentStatusEnum("status").default("IDLE").notNull(),
  capabilities: jsonb("capabilities").notNull(),
  metrics: jsonb("metrics").notNull(),
  limits: jsonb("limits").notNull(),
});

export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  missionId: uuid("mission_id").references(() => missions.id).notNull(),
  agentRole: agentRoleEnum("agent_role").notNull(),
  status: agentStatusEnum("status").notNull(),
  tokensUsed: integer("tokens_used").default(0).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(), // e.g. "TASK-001"
  missionId: uuid("mission_id").references(() => missions.id).notNull(),
  order: integer("order").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  assignedRole: agentRoleEnum("assigned_role").notNull(),
  status: taskStatusEnum("status").default("BACKLOG").notNull(),
  priority: severityEnum("priority").default("MEDIUM").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(3).notNull(),
  acceptanceCriteria: jsonb("acceptance_criteria").notNull(),
  affectedFiles: jsonb("affected_files").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const taskDependencies = pgTable("task_dependencies", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: text("task_id").references(() => tasks.id).notNull(),
  dependsOnTaskId: text("depends_on_task_id").references(() => tasks.id).notNull(),
});

export const issues = pgTable("issues", {
  id: text("id").primaryKey(), // e.g. "ISSUE-004"
  missionId: uuid("mission_id").references(() => missions.id).notNull(),
  taskId: text("task_id").references(() => tasks.id).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: severityEnum("severity").default("HIGH").notNull(),
  status: issueStatusEnum("status").default("OPEN").notNull(),
  reportedByRole: agentRoleEnum("reported_by_role").notNull(),
  assignedToRole: agentRoleEnum("assigned_to_role").notNull(),
  stackTrace: text("stack_trace"),
  affectedFile: text("affected_file"),
  proposedFix: text("proposed_fix"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const testRuns = pgTable("test_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  missionId: uuid("mission_id").references(() => missions.id).notNull(),
  taskId: text("task_id").references(() => tasks.id).notNull(),
  agentRole: agentRoleEnum("agent_role").notNull(),
  suiteName: text("suite_name").notNull(),
  passedCount: integer("passed_count").default(0).notNull(),
  failedCount: integer("failed_count").default(0).notNull(),
  skippedCount: integer("skipped_count").default(0).notNull(),
  durationMs: integer("duration_ms").default(0).notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const activityEvents = pgTable("activity_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  missionId: uuid("mission_id").references(() => missions.id).notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
  type: text("type").notNull(),
  agentRole: agentRoleEnum("agent_role"),
  targetRole: agentRoleEnum("target_role"),
  taskId: text("task_id"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  severity: text("severity").default("INFO").notNull(),
  metadata: jsonb("metadata"),
});

export const artifacts = pgTable("artifacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  missionId: uuid("mission_id").references(() => missions.id).notNull(),
  taskId: text("task_id"),
  path: text("path").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  agentRole: agentRoleEnum("agent_role").notNull(),
  linesCount: integer("lines_count").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const approvals = pgTable("approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  missionId: uuid("mission_id").references(() => missions.id).notNull(),
  requestedByRole: agentRoleEnum("requested_by_role").notNull(),
  actionTitle: text("action_title").notNull(),
  description: text("description").notNull(),
  risk: severityEnum("risk").default("HIGH").notNull(),
  reason: text("reason").notNull(),
  status: approvalStatusEnum("status").default("PENDING").notNull(),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  responseNote: text("response_note"),
});
