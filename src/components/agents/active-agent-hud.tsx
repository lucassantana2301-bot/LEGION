"use client";

import React from "react";
import { Compass, Box, Hammer, ShieldAlert, Cpu, Sparkles, Activity } from "lucide-react";
import { useMissionRuntimeStore } from "@/stores/mission-runtime-store";
import { AgentRole } from "@/types/domain";

export const ActiveAgentHud: React.FC = () => {
  const { status, activeAgent, activeAgentStatus, activeTaskId, activeTaskIds, concurrencyLimit, tasks } = useMissionRuntimeStore();

  const isRunning = status === "PLANNING" || status === "EXECUTING" || status === "VERIFYING";

  const runningTasks = tasks.filter((t) => t.status === "RUNNING" || t.status === "VERIFYING");
  const currentTask = tasks.find((t) => t.id === activeTaskId) || runningTasks[0];

  const roleMeta: Record<
    string,
    { label: string; actionText: string; icon: React.ElementType; color: string; bgClass: string; borderClass: string; textClass: string }
  > = {
    COMMANDER: {
      label: "COMMANDER",
      actionText: "FORMULATING TASK DAG // STRATEGY",
      icon: Compass,
      color: "#818cf8",
      bgClass: "bg-commander/10",
      borderClass: "border-commander/30",
      textClass: "text-commander",
    },
    ARCHITECT: {
      label: "ARCHITECT",
      actionText: "SPECIFYING CONTRACTS // TOPOLOGY",
      icon: Box,
      color: "#38bdf8",
      bgClass: "bg-architect/10",
      borderClass: "border-architect/30",
      textClass: "text-architect",
    },
    BUILDER: {
      label: "BUILDER",
      actionText: "IMPLEMENTING CODE // SANDBOX EXECUTION",
      icon: Hammer,
      color: "#fbbf24",
      bgClass: "bg-builder/10",
      borderClass: "border-builder/30",
      textClass: "text-builder",
    },
    SENTINEL: {
      label: "SENTINEL",
      actionText: "VALIDATING QUALITY // QA GATEKEEPER",
      icon: ShieldAlert,
      color: "#34d399",
      bgClass: "bg-sentinel/10",
      borderClass: "border-sentinel/30",
      textClass: "text-sentinel",
    },
    ORCHESTRATOR: {
      label: "ORCHESTRATOR",
      actionText: "COORDINATING RUNTIME CYCLE",
      icon: Cpu,
      color: "#c084fc",
      bgClass: "bg-orchestrator/10",
      borderClass: "border-orchestrator/30",
      textClass: "text-orchestrator",
    },
  };

  const activeKey = activeAgent || (status === "PLANNING" ? "COMMANDER" : status === "EXECUTING" ? "BUILDER" : status === "VERIFYING" ? "SENTINEL" : "ORCHESTRATOR");
  const currentMeta = roleMeta[activeKey] || roleMeta.ORCHESTRATOR;
  const Icon = currentMeta.icon;

  if (!isRunning && status !== "COMPLETED" && status !== "FAILED") {
    return (
      <div className="rounded-lg border border-border bg-surfaceRaised/40 p-3.5 flex items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2.5 text-mutedForeground">
          <div className="w-2 h-2 rounded-full bg-mutedForeground/40" />
          <span className="font-semibold text-foreground">TACTICAL AGENT HUD:</span>
          <span>ALL AGENTS SYNCHRONIZED // STANDBY</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-mutedForeground">
          <span className="px-2 py-0.5 rounded bg-surface border border-border">4 AGENTS ONLINE</span>
          <span className="px-2 py-0.5 rounded bg-surface border border-border text-accent">PARALLEL DAG READY</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border p-4 transition-all duration-300 relative overflow-hidden bg-surfaceRaised/80 ${
        isRunning ? `${currentMeta.borderClass} shadow-lg shadow-black/40` : "border-border"
      }`}
    >
      {/* Background subtle tactical glow */}
      {isRunning && (
        <div
          className="absolute -right-12 -top-12 w-48 h-48 rounded-full blur-3xl opacity-15 pointer-events-none"
          style={{ backgroundColor: currentMeta.color }}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg border ${currentMeta.bgClass} ${currentMeta.borderClass}`}>
            <Icon className={`w-5 h-5 ${currentMeta.textClass} ${isRunning ? "animate-pulse" : ""}`} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold tracking-widest text-mutedForeground uppercase">
                ACTIVE AGENT UNIT
              </span>
              <span className="text-mutedForeground font-mono text-xs">/</span>
              <span className={`text-xs font-mono font-bold uppercase tracking-wider ${currentMeta.textClass}`}>
                {currentMeta.label}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${currentMeta.bgClass} ${currentMeta.borderClass} ${currentMeta.textClass}`}>
                {activeAgentStatus || (isRunning ? "EXECUTING" : status)}
              </span>
            </div>

            <div className="text-sm font-semibold font-mono text-foreground mt-1 flex items-center gap-2">
              <span className="truncate">
                {runningTasks.length > 1 ? (
                  <span>
                    PARALLEL EXECUTION: {runningTasks.map((t) => `${t.id} (${t.assignedRole})`).join(" & ")}
                  </span>
                ) : currentTask ? (
                  `${currentTask.id}: ${currentTask.title}`
                ) : (
                  currentMeta.actionText
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          {runningTasks.length > 0 && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-surface border border-border text-mutedForeground">
              <span>ACTIVE WORKERS:</span>
              <strong className="text-accent">{runningTasks.length} / {concurrencyLimit || 2}</strong>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface border border-border text-mutedForeground">
            <Activity className="w-3.5 h-3.5 text-accent animate-pulse" />
            <span className="text-[11px] font-bold text-foreground uppercase">{status}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
