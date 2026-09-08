"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMissionSlice } from "@/stores/mission-slice";
import { useTasksSlice } from "@/stores/tasks-slice";
import { Layers, CheckCircle2, AlertTriangle, Cpu, DollarSign, Activity } from "lucide-react";

export const MissionProgressCard: React.FC = () => {
  const mission = useMissionSlice((s) => s.mission);
  const tasks = useTasksSlice((s) => s.tasks);
  const issues = useTasksSlice((s) => s.issues);

  const completedCount = tasks.filter((t) => t.status === "COMPLETED").length;
  const totalCount = tasks.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : mission.progressPercent;
  const openIssues = issues.filter((i) => i.status !== "RESOLVED").length;

  return (
    <div className="space-y-4">
      {/* Top Main Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card variant="raised" className="lg:col-span-2 p-5 border-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-mono font-semibold tracking-wider text-mutedForeground uppercase">
                Current Mission
              </span>
              <Badge variant="outline" size="sm">
                ID: {mission.id}
              </Badge>
            </div>
            <h2 className="text-base font-semibold text-foreground font-sans leading-snug">
              {mission.title}
            </h2>
            <p className="text-xs text-mutedForeground mt-2 font-mono">
              {mission.prompt}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-borderMuted flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono uppercase text-mutedForeground">Requirements:</span>
            {mission.brief.requirements.slice(0, 3).map((req, i) => (
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
                {completedCount} / {totalCount} TASKS
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-borderMuted grid grid-cols-2 gap-2 text-center font-mono text-xs">
            <div className="bg-surface p-2 rounded border border-border">
              <div className="text-[10px] text-mutedForeground uppercase">Tokens</div>
              <div className="text-foreground font-semibold mt-0.5">52.1K</div>
            </div>
            <div className="bg-surface p-2 rounded border border-border">
              <div className="text-[10px] text-mutedForeground uppercase">Est. Cost</div>
              <div className="text-foreground font-semibold mt-0.5">$0.42</div>
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
            {completedCount} <span className="text-xs text-mutedForeground">/ {totalCount}</span>
          </div>
        </div>

        <div className="bg-surface p-3 rounded-lg border border-border">
          <div className="flex items-center gap-1.5 text-mutedForeground text-[10px] font-mono uppercase mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-success" />
            <span>Tests</span>
          </div>
          <div className="text-sm font-bold font-mono text-foreground">
            8 <span className="text-xs text-mutedForeground">/ 10</span>
          </div>
        </div>

        <div className="bg-surface p-3 rounded-lg border border-border">
          <div className="flex items-center gap-1.5 text-mutedForeground text-[10px] font-mono uppercase mb-1">
            <Activity className="w-3.5 h-3.5 text-accent" />
            <span>Build</span>
          </div>
          <div className="text-xs font-bold font-mono text-accent uppercase">
            {mission.status === "COMPLETED" ? "READY" : "RUNNING"}
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
          <div className="text-sm font-bold font-mono text-foreground">52.1K</div>
        </div>

        <div className="bg-surface p-3 rounded-lg border border-border">
          <div className="flex items-center gap-1.5 text-mutedForeground text-[10px] font-mono uppercase mb-1">
            <DollarSign className="w-3.5 h-3.5 text-success" />
            <span>Cost</span>
          </div>
          <div className="text-sm font-bold font-mono text-foreground">$0.42</div>
        </div>
      </div>
    </div>
  );
};
