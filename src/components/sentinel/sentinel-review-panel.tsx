"use client";

import React from "react";
import { ShieldAlert, ShieldCheck, AlertOctagon, CheckCircle2, XCircle, HelpCircle, ArrowRight, Lightbulb } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMissionRuntimeStore } from "@/stores/mission-runtime-store";

export const SentinelReviewPanel: React.FC = () => {
  const { tasks, status } = useMissionRuntimeStore();

  // Find the most recent task that has a sentinel verdict or is currently being verified
  const reviewedTasks = tasks.filter((t) => t.sentinelDecision || t.status === "VERIFYING");
  const latestTask = reviewedTasks.length > 0 ? reviewedTasks[reviewedTasks.length - 1] : null;

  if (!latestTask || !latestTask.sentinelDecision) {
    return (
      <Card variant="raised" className="p-4 border-border flex flex-col justify-between">
        <div className="flex items-center justify-between pb-3 border-b border-borderMuted mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-sentinel" />
            <h3 className="text-xs font-mono font-bold tracking-wider text-mutedForeground uppercase">
              SENTINEL // QUALITY GATEKEEPER
            </h3>
          </div>
          <Badge variant="outline" size="sm">
            QA READY
          </Badge>
        </div>
        <div className="py-6 text-center text-xs font-mono text-mutedForeground flex flex-col items-center justify-center gap-2">
          <ShieldAlert className="w-8 h-8 text-mutedForeground/30" />
          <span>Awaiting code artifacts from Builder for quality & security verification.</span>
        </div>
      </Card>
    );
  }

  const decision = latestTask.sentinelDecision;
  const isApproved = decision === "APPROVED";
  const isRevision = decision === "REVISION_REQUIRED";
  const isFailed = decision === "FAILED";

  const decisionBadgeVariant = isApproved ? "success" : isRevision ? "warning" : "danger";

  return (
    <Card variant="raised" className="p-4 border-border flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-borderMuted mb-3">
          <div className="flex items-center gap-2">
            {isApproved ? (
              <ShieldCheck className="w-4 h-4 text-success" />
            ) : isRevision ? (
              <AlertOctagon className="w-4 h-4 text-warning animate-pulse" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-danger animate-pulse" />
            )}
            <h3 className="text-xs font-mono font-bold tracking-wider text-mutedForeground uppercase">
              SENTINEL // VERIFICATION VERDICT
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={decisionBadgeVariant} size="sm">
              {decision}
            </Badge>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-foreground font-semibold">
              QA Gate: {isApproved ? "PASS" : "ACTION REQUIRED"}
            </span>
          </div>
        </div>

        {/* Task Context */}
        <div className="text-xs font-mono mb-3 bg-surface p-2.5 rounded border border-border flex items-center justify-between">
          <span className="text-mutedForeground">
            Target Task: <strong className="text-foreground">{latestTask.id} — {latestTask.title}</strong>
          </span>
          <span className="text-[10px] text-mutedForeground">
            Attempt: <strong className="text-foreground">{latestTask.attempts}</strong>
          </span>
        </div>

        {/* Summary */}
        <div className="text-xs font-mono text-foreground mb-3 leading-relaxed">
          {latestTask.sentinelSummary || "Verification completed by Sentinel Gatekeeper."}
        </div>

        {/* Success Criteria Checklist */}
        {latestTask.successCriteria && latestTask.successCriteria.length > 0 && (
          <div className="space-y-1.5 mb-3">
            <span className="text-[10px] font-mono uppercase tracking-wider text-mutedForeground font-semibold block">
              Success Criteria Evaluation:
            </span>
            <div className="space-y-1">
              {latestTask.successCriteria.map((crit: string, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs font-mono p-2 rounded bg-surface border border-border"
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    {isApproved ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                    ) : (
                      <HelpCircle className="w-3.5 h-3.5 text-warning shrink-0" />
                    )}
                    <span className="truncate text-foreground">{crit}</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase shrink-0 ${
                      isApproved
                        ? "text-success bg-success/10 border border-success/30"
                        : "text-warning bg-warning/10 border border-warning/30"
                    }`}
                  >
                    {isApproved ? "PASS" : "EVALUATING"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Issues List */}
        {latestTask.sentinelIssues && latestTask.sentinelIssues.length > 0 && (
          <div className="space-y-1.5 mb-3">
            <span className="text-[10px] font-mono uppercase tracking-wider text-danger font-semibold flex items-center gap-1">
              <AlertOctagon className="w-3 h-3" />
              Discovered Defects ({latestTask.sentinelIssues.length}):
            </span>
            <div className="space-y-1.5">
              {latestTask.sentinelIssues.map((issue, idx: number) => (
                <div
                  key={idx}
                  className="p-2.5 rounded bg-danger/5 border border-danger/30 text-xs font-mono space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-danger">{issue.title}</span>
                    <Badge variant="danger" size="sm">
                      {issue.severity}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-mutedForeground">{issue.description}</p>
                  {issue.proposedFix && (
                    <div className="text-[10px] text-accent font-semibold">
                      Proposed Fix: {issue.proposedFix}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {latestTask.sentinelRecommendations && latestTask.sentinelRecommendations.length > 0 && (
          <div className="space-y-1.5 mt-3 pt-3 border-t border-borderMuted">
            <span className="text-[10px] font-mono uppercase tracking-wider text-accent font-semibold flex items-center gap-1">
              <Lightbulb className="w-3 h-3" />
              Recommendations for Builder:
            </span>
            <ul className="text-xs font-mono space-y-1 text-mutedForeground">
              {latestTask.sentinelRecommendations.map((rec: string, i: number) => (
                <li key={i} className="flex items-start gap-1.5">
                  <ArrowRight className="w-3 h-3 text-accent shrink-0 mt-0.5" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
};
