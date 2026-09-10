"use client";

import React from "react";
import { clsx } from "clsx";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  GitCommit,
  ArrowRight,
  ShieldAlert,
  Hammer,
  FileCode2,
  Layers,
  RotateCcw,
} from "lucide-react";
import { useMissionRuntimeStore, LiveTaskView, TaskStatusType } from "@/stores/mission-runtime-store";
import { Badge } from "@/components/ui/badge";

export const ParallelDagView: React.FC = () => {
  const tasks = useMissionRuntimeStore((s) => s.tasks);
  const activeTaskIds = useMissionRuntimeStore((s) => s.activeTaskIds);
  const concurrencyLimit = useMissionRuntimeStore((s) => s.concurrencyLimit);
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || tasks[0];

  const getStatusBadge = (status: TaskStatusType) => {
    switch (status) {
      case "COMPLETED":
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-success/15 text-success font-semibold border border-success/30">
            <CheckCircle2 className="w-3 h-3" /> COMPLETED
          </span>
        );
      case "RUNNING":
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-accent/20 text-accent font-semibold border border-accent/40 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" /> RUNNING
          </span>
        );
      case "VERIFYING":
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30 animate-pulse">
            <ShieldAlert className="w-3 h-3" /> VERIFYING
          </span>
        );
      case "REVISION_REQUIRED":
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-warning/20 text-warning font-semibold border border-warning/30">
            <RotateCcw className="w-3 h-3" /> REVISION
          </span>
        );
      case "FAILED":
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-danger/20 text-danger font-semibold border border-danger/30">
            <XCircle className="w-3 h-3" /> FAILED
          </span>
        );
      case "READY":
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-surfaceOverlay text-foreground font-semibold border border-border">
            <Clock className="w-3 h-3 text-accent" /> READY
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-surfaceOverlay text-mutedForeground border border-border">
            BACKLOG
          </span>
        );
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "ARCHITECT":
        return <FileCode2 className="w-3.5 h-3.5 text-sky-400" />;
      case "SENTINEL":
        return <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />;
      case "BUILDER":
      default:
        return <Hammer className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-border p-8 text-center text-mutedForeground font-mono text-xs">
        <Layers className="w-8 h-8 text-mutedForeground/40 mx-auto mb-3" />
        <p className="font-semibold text-foreground">No Tasks in DAG Pipeline</p>
        <p className="text-[11px] text-mutedForeground mt-1">
          When the Commander finishes planning, parallel tasks and dependency graphs will render here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Left: Interactive DAG Grid */}
      <div className="lg:col-span-7 space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent" />
            <h4 className="text-xs font-mono font-semibold tracking-wider text-foreground uppercase">
              Parallel Execution DAG ({tasks.length} Tasks)
            </h4>
          </div>
          <div className="text-[11px] font-mono text-mutedForeground">
            Concurrency Limit: <span className="text-foreground font-bold">{concurrencyLimit} Slots</span>
          </div>
        </div>

        {/* Task Cards Stack with Visual Dependency Indicators */}
        <div className="space-y-2.5">
          {tasks.map((task, idx) => {
            const isSelected = selectedTask?.id === task.id;
            const isRunning = task.status === "RUNNING";

            return (
              <div
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className={clsx(
                  "rounded-lg p-3.5 border transition-all cursor-pointer select-none",
                  isSelected
                    ? "bg-surfaceRaised border-accent shadow-sm ring-1 ring-accent/30"
                    : "bg-surface border-border hover:bg-surfaceRaised/60",
                  isRunning && "ring-1 ring-accent/40"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="w-6 h-6 rounded bg-surfaceOverlay border border-border text-[11px] font-mono font-bold text-mutedForeground flex items-center justify-center shrink-0">
                      {String(task.order).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-foreground">
                          {task.id}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-surfaceOverlay text-mutedForeground border border-border">
                          {getRoleIcon(task.assignedRole)}
                          <span>{task.assignedRole}</span>
                        </div>
                        <span
                          className={clsx(
                            "text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded uppercase",
                            task.priority === "CRITICAL"
                              ? "bg-danger/20 text-danger border border-danger/30"
                              : task.priority === "HIGH"
                              ? "bg-warning/20 text-warning border border-warning/30"
                              : "bg-surfaceOverlay text-mutedForeground"
                          )}
                        >
                          {task.priority}
                        </span>
                      </div>
                      <p className="text-xs text-foreground font-medium mt-1 truncate">
                        {task.title}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {getStatusBadge(task.status)}
                    {task.attempts > 1 && (
                      <span className="text-[10px] font-mono text-warning">
                        Attempt {task.attempts}/{task.maxAttempts}
                      </span>
                    )}
                  </div>
                </div>

                {/* Dependencies Link Bar */}
                {task.dependencies && task.dependencies.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center gap-2 text-[10px] font-mono text-mutedForeground">
                    <span>Depends on:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {task.dependencies.map((dep) => (
                        <span
                          key={dep}
                          className="px-1.5 py-0.5 rounded bg-surfaceOverlay text-accent font-semibold border border-border"
                        >
                          {dep}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Selected Task Inspector */}
      <div className="lg:col-span-5 bg-surface rounded-xl border border-border p-4 space-y-4">
        {selectedTask ? (
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <span className="text-[10px] font-mono uppercase text-mutedForeground">
                  Task Detail Inspector
                </span>
                <h4 className="text-sm font-mono font-bold text-foreground mt-0.5">
                  {selectedTask.id}: {selectedTask.title}
                </h4>
              </div>
              <div>{getStatusBadge(selectedTask.status)}</div>
            </div>

            <div className="mt-3 space-y-3 font-mono text-xs">
              {/* Description */}
              <div>
                <span className="text-[10px] text-mutedForeground uppercase tracking-wider block mb-1">
                  Description & Scope
                </span>
                <p className="text-foreground text-xs leading-relaxed bg-surfaceRaised p-2.5 rounded border border-border">
                  {selectedTask.description || "No specific instructions provided."}
                </p>
              </div>

              {/* Success Criteria */}
              {selectedTask.successCriteria && selectedTask.successCriteria.length > 0 && (
                <div>
                  <span className="text-[10px] text-mutedForeground uppercase tracking-wider block mb-1">
                    Success Criteria
                  </span>
                  <ul className="space-y-1 bg-surfaceRaised p-2.5 rounded border border-border">
                    {selectedTask.successCriteria.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-foreground">
                        <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Sentinel Audit Finding */}
              {selectedTask.sentinelSummary && (
                <div>
                  <span className="text-[10px] text-mutedForeground uppercase tracking-wider block mb-1">
                    Sentinel Verification Review
                  </span>
                  <div
                    className={clsx(
                      "p-2.5 rounded border space-y-1.5",
                      selectedTask.sentinelDecision === "APPROVED"
                        ? "bg-success/5 border-success/30 text-success"
                        : "bg-warning/5 border-warning/30 text-warning"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px]">
                        Decision: {selectedTask.sentinelDecision}
                      </span>
                    </div>
                    <p className="text-xs text-foreground">
                      {selectedTask.sentinelSummary}
                    </p>
                  </div>
                </div>
              )}

              {/* Error if failed */}
              {selectedTask.error && (
                <div>
                  <span className="text-[10px] text-danger uppercase tracking-wider block mb-1">
                    Execution Error
                  </span>
                  <pre className="bg-danger/10 text-danger p-2.5 rounded border border-danger/30 text-[11px] overflow-x-auto whitespace-pre-wrap">
                    {selectedTask.error}
                  </pre>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-mutedForeground font-mono text-xs">
            Select a task to inspect specifications and telemetry.
          </div>
        )}
      </div>
    </div>
  );
};
