"use client";

import React from "react";
import { X, CheckCircle2, AlertOctagon, FileCode, Clock, ShieldCheck, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status-dot";
import { useTasksSlice } from "@/stores/tasks-slice";

export const TaskDetailModal: React.FC = () => {
  const tasks = useTasksSlice((s) => s.tasks);
  const issues = useTasksSlice((s) => s.issues);
  const selectedTaskId = useTasksSlice((s) => s.selectedTaskId);
  const selectTask = useTasksSlice((s) => s.selectTask);

  if (!selectedTaskId) return null;

  const task = tasks.find((t) => t.id === selectedTaskId);
  if (!task) return null;

  const relatedIssues = issues.filter((i) => i.taskId === task.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/70 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl h-full sm:h-[90vh] sm:rounded-lg bg-surfaceRaised border border-border shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-border bg-surface flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold text-accent uppercase">
                {task.id}
              </span>
              <span className="text-mutedForeground text-xs font-mono">/</span>
              <Badge variant="outline" size="sm">
                PRIORITY: {task.priority}
              </Badge>
              <Badge variant="accent" size="sm">
                {task.assignedRole}
              </Badge>
            </div>
            <h2 className="text-base font-semibold text-foreground font-sans">
              {task.title}
            </h2>
          </div>

          <button
            onClick={() => selectTask(null)}
            className="p-1.5 rounded bg-surfaceRaised hover:bg-surfaceOverlay text-mutedForeground hover:text-foreground border border-border transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 font-mono text-xs">
          {/* Status and Progress Bar */}
          <div className="p-3.5 rounded bg-surface border border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusDot status={task.status} pulse={task.status === "IN_PROGRESS"} />
              <span className="text-xs font-bold uppercase text-foreground">
                STATUS: {task.status}
              </span>
            </div>
            <div className="text-[11px] text-mutedForeground">
              Attempts: <strong className="text-foreground">{task.attempts} / {task.maxAttempts}</strong>
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="text-[10px] text-mutedForeground uppercase font-semibold mb-1.5">
              Task Description
            </div>
            <p className="text-xs text-foreground leading-relaxed bg-surface p-3 rounded border border-borderMuted">
              {task.description}
            </p>
          </div>

          {/* Acceptance Criteria */}
          <div>
            <div className="text-[10px] text-mutedForeground uppercase font-semibold mb-2">
              Acceptance Criteria
            </div>
            <div className="space-y-1.5">
              {task.acceptanceCriteria.map((crit, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded bg-surface border border-borderMuted">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                  <span className="text-xs text-foreground">{crit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Affected Files */}
          <div>
            <div className="text-[10px] text-mutedForeground uppercase font-semibold mb-2">
              Affected Code Files
            </div>
            <div className="space-y-1.5">
              {task.affectedFiles.map((file, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded bg-surface border border-border">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-3.5 h-3.5 text-accent" />
                    <span className="text-xs text-foreground">{file}</span>
                  </div>
                  <Badge variant="outline" size="sm">
                    MODIFIED
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Associated Issues */}
          {relatedIssues.length > 0 && (
            <div>
              <div className="text-[10px] text-mutedForeground uppercase font-semibold mb-2">
                Associated Quality Issues ({relatedIssues.length})
              </div>
              <div className="space-y-2">
                {relatedIssues.map((issue) => (
                  <div key={issue.id} className="p-3 rounded bg-danger/10 border border-danger/30 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertOctagon className="w-3.5 h-3.5 text-danger" />
                        <strong className="text-xs text-foreground font-bold">{issue.id}</strong>
                      </div>
                      <Badge variant={issue.status === "RESOLVED" ? "success" : "danger"} size="sm">
                        {issue.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-foreground">{issue.title}</div>
                    <pre className="text-[10px] text-mutedForeground bg-background p-2 rounded whitespace-pre-wrap">
                      {issue.stackTrace}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Execution History & Timestamps */}
          <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-mutedForeground">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Created: {task.createdAt.slice(0, 10)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-success" />
              <span>Sentinel Verification Enabled</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
