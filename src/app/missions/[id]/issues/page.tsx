"use client";

import React from "react";
import { AlertOctagon, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTasksSlice } from "@/stores/tasks-slice";

export const dynamic = "force-dynamic";

export default function IssuesPage() {
  const issues = useTasksSlice((s) => s.issues);

  const openCount = issues.filter((i) => i.status !== "RESOLVED").length;
  const resolvedCount = issues.filter((i) => i.status === "RESOLVED").length;

  return (
    <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full font-mono select-none">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="text-xs font-bold text-mutedForeground uppercase flex items-center gap-2">
            <span>SENTINEL QUALITY GATEKEEPER</span>
            <span>/</span>
            <span className="text-foreground">ISSUES & REVIEWS</span>
          </div>
          <h1 className="text-xl font-bold font-sans text-foreground mt-1">
            Quality Issues
          </h1>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Badge variant={openCount > 0 ? "warning" : "outline"} size="md">
            {openCount} OPEN
          </Badge>
          <Badge variant="success" size="md">
            {resolvedCount} RESOLVED
          </Badge>
        </div>
      </div>

      {/* Issues Content */}
      {issues.length === 0 ? (
        <div className="p-12 rounded-lg bg-surface/50 border border-border border-dashed text-center font-mono text-xs text-mutedForeground space-y-2">
          <ShieldCheck className="w-8 h-8 text-success/60 mx-auto" />
          <div className="font-semibold text-foreground">ZERO DEFECTS // ALL SYSTEMS NOMINAL</div>
          <div className="text-[11px] text-mutedForeground/70 max-w-md mx-auto">
            Sentinel has not detected any open defects or failed validation criteria. Discovered issues will appear here.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {issues.map((issue) => {
            const isResolved = issue.status === "RESOLVED";

            return (
              <div
                key={issue.id}
                className={`p-5 rounded-lg border transition-all ${
                  isResolved
                    ? "bg-surface border-border opacity-80"
                    : "bg-danger/5 border-danger/40"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <AlertOctagon className={`w-5 h-5 ${isResolved ? "text-success" : "text-danger"}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{issue.id}</span>
                        {issue.taskId && <span className="text-xs text-mutedForeground">/ Task: {issue.taskId}</span>}
                        <Badge variant={isResolved ? "success" : "danger"} size="sm">
                          {issue.status}
                        </Badge>
                        <Badge variant="outline" size="sm">
                          SEVERITY: {issue.severity}
                        </Badge>
                      </div>
                      <h3 className="text-sm font-semibold text-foreground font-sans mt-1">
                        {issue.title}
                      </h3>
                    </div>
                  </div>

                  <div className="text-xs text-mutedForeground">
                    Reported by: <strong className="text-success">{issue.reportedByRole || "SENTINEL"}</strong> → Assigned: <strong className="text-warning">{issue.assignedToRole || "BUILDER"}</strong>
                  </div>
                </div>

                {issue.stackTrace && (
                  <div className="space-y-3 text-xs bg-background/50 p-3.5 rounded border border-borderMuted">
                    <div>
                      <div className="text-[10px] text-mutedForeground uppercase font-bold mb-1">
                        Reproduction Stack Trace:
                      </div>
                      <pre className="text-[11px] text-mutedForeground whitespace-pre-wrap">
                        {issue.stackTrace}
                      </pre>
                    </div>

                    {issue.proposedFix && (
                      <div className="pt-2 border-t border-borderMuted text-[11px] text-accent">
                        <strong>Proposed Fix:</strong> {issue.proposedFix}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
