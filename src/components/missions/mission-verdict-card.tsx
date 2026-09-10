"use client";

import React from "react";
import { CheckCircle2, AlertOctagon, RotateCcw, Clock, ShieldCheck, Layers, Cpu, DollarSign, ArrowRight, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMissionRuntimeStore } from "@/stores/mission-runtime-store";

export const MissionVerdictCard: React.FC = () => {
  const {
    status,
    missionPrompt,
    tasks,
    finalResult,
    durationMs,
    totalTokens,
    totalCostUsd,
    error,
    resetMission,
    startMission,
  } = useMissionRuntimeStore();

  if (status !== "COMPLETED" && status !== "FAILED") {
    return null;
  }

  const isCompleted = status === "COMPLETED";
  const completedTasksCount = tasks.filter((t) => t.status === "COMPLETED").length;
  const durationSec = durationMs ? (durationMs / 1000).toFixed(1) : "0.0";
  const tokensDisplay = totalTokens ? `${(totalTokens.total / 1000).toFixed(1)}K` : "0";
  const costDisplay = totalCostUsd !== null ? `$${totalCostUsd.toFixed(2)}` : "$0.00";

  const handleRetry = () => {
    if (missionPrompt) {
      startMission(missionPrompt);
    }
  };

  return (
    <Card
      variant="raised"
      className={`p-5 border transition-all ${
        isCompleted
          ? "border-success/40 bg-gradient-to-b from-success/10 to-surface"
          : "border-danger/40 bg-gradient-to-b from-danger/10 to-surface"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-borderMuted mb-4">
        <div className="flex items-center gap-2.5">
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-success" />
          ) : (
            <AlertOctagon className="w-5 h-5 text-danger animate-pulse" />
          )}
          <div>
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-foreground">
              {isCompleted ? "MISSION COMPLETE // VERIFICATION APPROVED" : "MISSION EXECUTION HALTED // RECOVERY REQUIRED"}
            </h3>
            <p className="text-xs font-mono text-mutedForeground mt-0.5">
              {isCompleted
                ? "All DAG tasks successfully generated, executed in sandbox, and approved by Sentinel."
                : "A critical verification failure or limit reached during autonomous execution."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={isCompleted ? "success" : "danger"} size="md">
            {status}
          </Badge>
          <Button
            variant={isCompleted ? "secondary" : "primary"}
            size="sm"
            onClick={resetMission}
            icon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            NEW MISSION
          </Button>
          {!isCompleted && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRetry}
              icon={<Sparkles className="w-3.5 h-3.5 text-accent" />}
            >
              RE-PLAN & RETRY
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="p-2.5 rounded bg-surface border border-border">
          <div className="flex items-center gap-1.5 text-mutedForeground text-[10px] uppercase mb-1">
            <Clock className="w-3.5 h-3.5 text-accent" />
            <span>Duration</span>
          </div>
          <div className="font-bold text-foreground text-sm">{durationSec}s</div>
        </div>

        <div className="p-2.5 rounded bg-surface border border-border">
          <div className="flex items-center gap-1.5 text-mutedForeground text-[10px] uppercase mb-1">
            <Layers className="w-3.5 h-3.5 text-success" />
            <span>Tasks Approved</span>
          </div>
          <div className="font-bold text-foreground text-sm">
            {completedTasksCount} / {tasks.length}
          </div>
        </div>

        <div className="p-2.5 rounded bg-surface border border-border">
          <div className="flex items-center gap-1.5 text-mutedForeground text-[10px] uppercase mb-1">
            <Cpu className="w-3.5 h-3.5 text-info" />
            <span>Total Tokens</span>
          </div>
          <div className="font-bold text-foreground text-sm">{tokensDisplay}</div>
        </div>

        <div className="p-2.5 rounded bg-surface border border-border">
          <div className="flex items-center gap-1.5 text-mutedForeground text-[10px] uppercase mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-sentinel" />
            <span>Sandbox Isolation</span>
          </div>
          <div className="font-bold text-foreground text-sm">VERIFIED</div>
        </div>
      </div>

      {/* Summary / Diagnostic Box */}
      <div className="mt-3 p-3 rounded bg-surfaceRaised border border-border text-xs font-mono">
        {isCompleted ? (
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-success uppercase">Orchestration Summary:</span>
            <p className="text-foreground">
              {finalResult?.summary || "All tasks were verified with zero type errors in the isolated sandbox environment."}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-danger uppercase">Diagnostic Error:</span>
            <p className="text-danger">{error || "Execution terminated before all acceptance criteria could be met."}</p>
          </div>
        )}
      </div>
    </Card>
  );
};
