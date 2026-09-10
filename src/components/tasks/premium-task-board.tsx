"use client";

import React, { useState } from "react";
import {
  Layers,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  HelpCircle,
  FileCode,
  ShieldAlert,
  ShieldCheck,
  Hammer,
  Bot,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMissionRuntimeStore, TaskStatusType, LiveTaskView } from "@/stores/mission-runtime-store";

export const PremiumTaskBoard: React.FC = () => {
  const { tasks, status } = useMissionRuntimeStore();
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"ALL" | "RUNNING" | "COMPLETED" | "FAILED">("ALL");

  const toggleTask = (id: string) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredTasks = tasks.filter((t) => {
    if (filter === "RUNNING") return t.status === "RUNNING" || t.status === "VERIFYING";
    if (filter === "COMPLETED") return t.status === "COMPLETED";
    if (filter === "FAILED") return t.status === "FAILED" || t.status === "REVISION_REQUIRED";
    return true;
  });

  const getStatusBadge = (tStatus: TaskStatusType) => {
    switch (tStatus) {
      case "COMPLETED":
        return <Badge variant="success">COMPLETED</Badge>;
      case "RUNNING":
        return <Badge variant="accent">RUNNING</Badge>;
      case "VERIFYING":
        return <Badge variant="warning">VERIFYING</Badge>;
      case "REVISION_REQUIRED":
        return <Badge variant="warning">REVISION REQUIRED</Badge>;
      case "FAILED":
        return <Badge variant="danger">FAILED</Badge>;
      case "READY":
        return <Badge variant="info">READY</Badge>;
      default:
        return <Badge variant="default">BACKLOG</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "BUILDER":
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-builder/10 border border-builder/30 text-builder uppercase">BUILDER</span>;
      case "SENTINEL":
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-sentinel/10 border border-sentinel/30 text-sentinel uppercase">SENTINEL</span>;
      case "ARCHITECT":
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-architect/10 border border-architect/30 text-architect uppercase">ARCHITECT</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-commander/10 border border-commander/30 text-commander uppercase">COMMANDER</span>;
    }
  };

  return (
    <Card variant="raised" className="p-4 border-border">
      {/* Header & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-borderMuted mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-accent" />
          <h3 className="text-xs font-mono font-bold tracking-wider text-mutedForeground uppercase">
            TASK GRAPH // DAG EXECUTION BOARD
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-foreground font-semibold">
            {tasks.length} TASKS
          </span>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 text-xs font-mono">
          {(["ALL", "RUNNING", "COMPLETED", "FAILED"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-0.5 rounded transition-colors text-[10px] uppercase font-semibold ${
                filter === f
                  ? "bg-accent text-white"
                  : "bg-surface hover:bg-surfaceOverlay text-mutedForeground hover:text-foreground border border-border"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <div className="py-8 text-center text-xs font-mono text-mutedForeground">
          {tasks.length === 0
            ? "No tasks dispatched yet. Enter a mission prompt to generate the dynamic task graph."
            : `No tasks matching filter "${filter}".`}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((t, index) => {
            const isExpanded = expandedTaskIds.has(t.id);
            const isRunning = t.status === "RUNNING" || t.status === "VERIFYING";

            return (
              <div
                key={t.id}
                className={`rounded-lg border transition-all text-xs font-mono bg-surface overflow-hidden ${
                  isRunning
                    ? "border-accent/50 bg-accent/5 shadow-sm"
                    : t.status === "COMPLETED"
                    ? "border-success/30 hover:border-border"
                    : t.status === "FAILED"
                    ? "border-danger/40"
                    : "border-border hover:border-borderMuted"
                }`}
              >
                {/* Compact Row */}
                <div
                  onClick={() => toggleTask(t.id)}
                  className="p-3 flex flex-wrap items-center justify-between gap-2.5 cursor-pointer select-none hover:bg-surfaceRaised/50 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="text-mutedForeground font-mono text-[11px] shrink-0 font-bold">
                      #{index + 1}
                    </span>
                    <span className="text-mutedForeground text-[10px] shrink-0 px-1.5 py-0.2 rounded bg-surfaceRaised border border-border">
                      {t.id}
                    </span>
                    <span className="font-semibold text-foreground truncate">
                      {t.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {getRoleBadge(t.assignedRole)}
                    <span className="text-[10px] text-mutedForeground px-1.5 py-0.5 rounded bg-surfaceRaised border border-border hidden sm:inline-block">
                      Att: {t.attempts}/{t.maxAttempts}
                    </span>
                    {getStatusBadge(t.status)}
                    <button className="text-mutedForeground hover:text-foreground p-0.5">
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-3 border-t border-borderMuted bg-background/50 space-y-2.5">
                    {/* Description */}
                    {t.description && (
                      <p className="text-xs text-mutedForeground">{t.description}</p>
                    )}

                    {/* Dependencies & Criteria */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                      {t.dependencies && t.dependencies.length > 0 && (
                        <div className="p-2 rounded bg-surface border border-border space-y-1">
                          <span className="text-[10px] font-bold text-mutedForeground uppercase">
                            Dependencies:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {t.dependencies.map((dep) => (
                              <span key={dep} className="px-1.5 py-0.2 rounded bg-surfaceRaised border border-border text-foreground">
                                {dep}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {t.successCriteria && t.successCriteria.length > 0 && (
                        <div className="p-2 rounded bg-surface border border-border space-y-1">
                          <span className="text-[10px] font-bold text-mutedForeground uppercase">
                            Success Criteria:
                          </span>
                          <ul className="space-y-0.5 text-mutedForeground">
                            {t.successCriteria.map((c: string, i: number) => (
                              <li key={i} className="flex items-start gap-1">
                                <span className="text-accent">✓</span>
                                <span>{c}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Sentinel Verdict Info */}
                    {t.sentinelDecision && (
                      <div className="p-2.5 rounded bg-surfaceRaised border border-border space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-mutedForeground">
                            Sentinel Verdict:
                          </span>
                          <Badge
                            variant={
                              t.sentinelDecision === "APPROVED"
                                ? "success"
                                : t.sentinelDecision === "REVISION_REQUIRED"
                                ? "warning"
                                : "danger"
                            }
                            size="sm"
                          >
                            {t.sentinelDecision}
                          </Badge>
                        </div>
                        <p className="text-xs text-foreground mt-1">{t.sentinelSummary || "Verified by Sentinel."}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};
