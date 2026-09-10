"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMissionSlice } from "@/stores/mission-slice";
import { useTasksSlice } from "@/stores/tasks-slice";
import { useMissionRuntimeStore } from "@/stores/mission-runtime-store";
import { Layers, CheckCircle2, AlertTriangle, Cpu, DollarSign, Activity } from "lucide-react";

export const MissionProgressCard: React.FC = () => {
  const mission = useMissionSlice((s) => s.mission);
  const tasks = useTasksSlice((s) => s.tasks);
  const issues = useTasksSlice((s) => s.issues);
  const runtime = useMissionRuntimeStore();

  const isRuntimeActive = runtime.status !== "IDLE";

  // Derive counts & progress based on whether real runtime or slice is active
  let title = mission.title;
  let promptText = mission.prompt;
  let requirements = mission.brief.requirements;
  let totalTasks = tasks.length;
  let completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
  let openIssues = issues.filter((i) => i.status !== "RESOLVED").length;
  let progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  let tokensDisplay = "0";
  let costDisplay = "$0.00";
  let buildStatus: string = mission.status === "COMPLETED" ? "READY" : (mission.status === "DRAFT" ? "STANDBY" : "RUNNING");
  let testDisplay = "0 / 0";

  if (isRuntimeActive) {
    title = runtime.finalResult?.plan?.title || (runtime.missionPrompt ? `Mission: ${runtime.missionPrompt.slice(0, 60)}...` : "Live Mission Execution");
    promptText = runtime.missionPrompt || "Executing multi-agent pipeline...";
    requirements = runtime.finalResult?.plan?.constraints || ["TypeScript strict mode", "E2B micro-VM sandbox execution", "Sentinel validation"];
    totalTasks = runtime.tasks.length;
    completedTasks = runtime.tasks.filter((t) => t.status === "COMPLETED").length;
    progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : (runtime.status === "COMPLETED" ? 100 : 0);
    tokensDisplay = runtime.totalTokens ? `${(runtime.totalTokens.total / 1000).toFixed(1)}K` : "0";
    costDisplay = runtime.totalCostUsd !== null ? `$${runtime.totalCostUsd.toFixed(2)}` : "$0.00";
    buildStatus = runtime.status === "COMPLETED" ? "READY" : (runtime.status === "FAILED" ? "FAILED" : "RUNNING");
    testDisplay = `${completedTasks} / ${totalTasks > 0 ? totalTasks : 0}`;
  } else if (mission.status === "DRAFT" && totalTasks === 0) {
    title = "LEGION // STANDBY";
    promptText = "No active mission. Awaiting mission directive.";
    requirements = [
      "Enter mission prompt in Mission Control to deploy agents",
      "Multi-agent autonomous planning & execution",
      "E2B isolated sandbox verification",
    ];
    progress = 0;
    tokensDisplay = "0";
    costDisplay = "$0.00";
    buildStatus = "STANDBY";
    testDisplay = "0 / 0";
  }

  return (
    <div className="space-y-4">
      {/* Top Main Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card variant="raised" className="lg:col-span-2 p-5 border-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-mono font-semibold tracking-wider text-mutedForeground uppercase">
                {isRuntimeActive ? "Active Mission Runtime" : "Current Mission"}
              </span>
              <Badge variant="outline" size="sm">
                STATUS: {isRuntimeActive ? runtime.status : mission.status}
              </Badge>
            </div>
            <h2 className="text-base font-semibold text-foreground font-sans leading-snug">
              {title}
            </h2>
            <p className="text-xs text-mutedForeground mt-2 font-mono">
              {promptText}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-borderMuted flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono uppercase text-mutedForeground">Requirements:</span>
            {requirements.slice(0, 3).map((req, i) => (
              <span
                key={i}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-foreground truncate max-w-xs"
              >
                ✓ {req}
              </span>
            ))}
          </div>
        </Card>

        {/* Progress Metric Card */}
        <Card variant="raised" className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-mutedForeground uppercase mb-2">
              <span>Mission Progress</span>
              <span className="text-accent font-bold">{progress}%</span>
            </div>
            <div className="w-full bg-surface h-2 rounded-full overflow-hidden border border-border">
              <div
                className="bg-accent h-full rounded-full transition-all duration-500 ease-out shadow-glow"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs font-mono text-mutedForeground mt-3">
              <span>Verified Tasks</span>
              <span className="text-foreground font-semibold">
                {completedTasks} / {totalTasks} TASKS
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-borderMuted grid grid-cols-2 gap-2 text-center font-mono text-xs">
            <div className="bg-surface p-2 rounded border border-border">
              <div className="text-[10px] text-mutedForeground uppercase">Tokens</div>
              <div className="text-foreground font-semibold mt-0.5">{tokensDisplay}</div>
            </div>
            <div className="bg-surface p-2 rounded border border-border">
              <div className="text-[10px] text-mutedForeground uppercase">Est. Cost</div>
              <div className="text-foreground font-semibold mt-0.5">{costDisplay}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Compact Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-surface p-3 rounded-lg border border-border">
          <div className="flex items-center gap-1.5 text-mutedForeground text-[10px] font-mono uppercase mb-1">
            <Layers className="w-3.5 h-3.5 text-accent" />
            <span>Tasks</span>
          </div>
          <div className="text-sm font-bold font-mono text-foreground">
            {completedTasks} <span className="text-xs text-mutedForeground">/ {totalTasks}</span>
          </div>
        </div>

        <div className="bg-surface p-3 rounded-lg border border-border">
          <div className="flex items-center gap-1.5 text-mutedForeground text-[10px] font-mono uppercase mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-success" />
            <span>Tests</span>
          </div>
          <div className="text-sm font-bold font-mono text-foreground">
            {testDisplay}
          </div>
        </div>

        <div className="bg-surface p-3 rounded-lg border border-border">
          <div className="flex items-center gap-1.5 text-mutedForeground text-[10px] font-mono uppercase mb-1">
            <Activity className="w-3.5 h-3.5 text-accent" />
            <span>Build</span>
          </div>
          <div className="text-xs font-bold font-mono text-accent uppercase">
            {buildStatus}
          </div>
        </div>

        <div className="bg-surface p-3 rounded-lg border border-border">
          <div className="flex items-center gap-1.5 text-mutedForeground text-[10px] font-mono uppercase mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-warning" />
            <span>Issues</span>
          </div>
          <div className="text-sm font-bold font-mono text-warning">
            {openIssues} <span className="text-[10px] font-normal uppercase">OPEN</span>
          </div>
        </div>

        <div className="bg-surface p-3 rounded-lg border border-border">
          <div className="flex items-center gap-1.5 text-mutedForeground text-[10px] font-mono uppercase mb-1">
            <Cpu className="w-3.5 h-3.5 text-info" />
            <span>Tokens</span>
          </div>
          <div className="text-sm font-bold font-mono text-foreground">{tokensDisplay}</div>
        </div>

        <div className="bg-surface p-3 rounded-lg border border-border">
          <div className="flex items-center gap-1.5 text-mutedForeground text-[10px] font-mono uppercase mb-1">
            <DollarSign className="w-3.5 h-3.5 text-success" />
            <span>Cost</span>
          </div>
          <div className="text-sm font-bold font-mono text-foreground">{costDisplay}</div>
        </div>
      </div>
    </div>
  );
};
