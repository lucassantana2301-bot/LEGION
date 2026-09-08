"use client";

import React from "react";
import { AlertOctagon, CheckCircle2, ArrowRight, ShieldAlert, Hammer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTasksSlice } from "@/stores/tasks-slice";

export const FailureLoopBanner: React.FC = () => {
  const issues = useTasksSlice((s) => s.issues);
  const tasks = useTasksSlice((s) => s.tasks);

  const activeIssue = issues.find((i) => i.id === "ISSUE-004");
  const relatedTask = tasks.find((t) => t.id === "TASK-008");

  if (!activeIssue) return null;

  const isResolved = activeIssue.status === "RESOLVED";

  return (
    <div className={`rounded-lg border p-4 transition-all ${
      isResolved
        ? "bg-success/5 border-success/30"
        : "bg-danger/5 border-danger/40"
    }`}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          {isResolved ? (
            <CheckCircle2 className="w-5 h-5 text-success" />
          ) : (
            <AlertOctagon className="w-5 h-5 text-danger animate-pulse" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-foreground uppercase">
                FAILURE RECOVERY LOOP // {activeIssue.id}
              </span>
              <Badge variant={isResolved ? "success" : "danger"} size="sm">
                {activeIssue.status}
              </Badge>
              <Badge variant="outline" size="sm">
                SEVERITY: {activeIssue.severity}
              </Badge>
            </div>
            <div className="text-xs font-mono text-mutedForeground mt-0.5">
              Task: <strong className="text-foreground">{relatedTask?.title || "TASK-008"}</strong>
            </div>
          </div>
        </div>

        <div className="text-xs font-mono text-mutedForeground">
          Loop Circuit: <span className="text-foreground font-semibold">1 / 3 Max Retries</span>
        </div>
      </div>

      {/* Interactive Loop Flow Visualizer */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 my-3 p-3 bg-surface rounded border border-border text-center font-mono text-xs">
        {/* Step 1: Sentinel Detects */}
        <div className={`p-2.5 rounded border flex flex-col items-center justify-center gap-1 ${
          !isResolved ? "bg-danger/10 border-danger/30 text-danger" : "bg-surfaceRaised border-border text-mutedForeground"
        }`}>
          <ShieldAlert className="w-4 h-4" />
          <span className="font-bold text-[10px]">1. SENTINEL</span>
          <span className="text-[9px]">REJECTED TASK</span>
        </div>

        {/* Arrow */}
        <div className="hidden sm:flex items-center justify-center text-mutedForeground">
          <ArrowRight className="w-4 h-4" />
        </div>

        {/* Step 2: Issue logged & assigned */}
        <div className="p-2.5 rounded border bg-surfaceRaised border-border flex flex-col items-center justify-center gap-1 text-warning">
          <AlertOctagon className="w-4 h-4" />
          <span className="font-bold text-[10px]">2. ISSUE #004</span>
          <span className="text-[9px]">TRIAGED</span>
        </div>

        {/* Arrow */}
        <div className="hidden sm:flex items-center justify-center text-mutedForeground">
          <ArrowRight className="w-4 h-4" />
        </div>

        {/* Step 3: Builder Fix & Sentinel Retest */}
        <div className={`p-2.5 rounded border flex flex-col items-center justify-center gap-1 ${
          isResolved ? "bg-success/15 border-success/40 text-success" : "bg-warning/10 border-warning/30 text-warning"
        }`}>
          {isResolved ? <CheckCircle2 className="w-4 h-4" /> : <Hammer className="w-4 h-4" />}
          <span className="font-bold text-[10px]">{isResolved ? "3. RESOLVED" : "3. BUILDER FIX"}</span>
          <span className="text-[9px]">{isResolved ? "TESTS PASSED" : "APPLYING PATCH"}</span>
        </div>
      </div>

      {/* Details & Stack Trace */}
      <div className="mt-2 text-xs font-mono bg-background/60 p-2.5 rounded border border-borderMuted">
        <div className="text-foreground font-semibold mb-1">
          Issue: {activeIssue.title}
        </div>
        <pre className="text-[11px] text-mutedForeground whitespace-pre-wrap">
          {activeIssue.stackTrace}
        </pre>
        {activeIssue.proposedFix && (
          <div className="mt-2 text-[11px] text-accent">
            <strong>Proposed Fix:</strong> {activeIssue.proposedFix}
          </div>
        )}
      </div>
    </div>
  );
};
