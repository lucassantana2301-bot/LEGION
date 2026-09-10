"use client";

import React from "react";
import { clsx } from "clsx";
import {
  Compass,
  FileCode2,
  Hammer,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Cpu,
} from "lucide-react";
import { useMissionRuntimeStore, TaskStatusType } from "@/stores/mission-runtime-store";

export const PipelineDeck: React.FC = () => {
  const missionStatus = useMissionRuntimeStore((s) => s.status);
  const activeAgent = useMissionRuntimeStore((s) => s.activeAgent);
  const activeAgentStatus = useMissionRuntimeStore((s) => s.activeAgentStatus);
  const activeTaskId = useMissionRuntimeStore((s) => s.activeTaskId);
  const tasks = useMissionRuntimeStore((s) => s.tasks);
  const finalResult = useMissionRuntimeStore((s) => s.finalResult);

  const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
  const runningTasks = tasks.filter((t) => t.status === "RUNNING").length;
  const verifyingTasks = tasks.filter((t) => t.status === "VERIFYING").length;

  // Derive agent states
  const getCommanderState = () => {
    if (missionStatus === "PLANNING") return { status: "WORKING", label: "Decomposing DAG & Planning" };
    if (tasks.length > 0) return { status: "SUCCESS", label: `${tasks.length} Tasks Formulated` };
    if (missionStatus === "FAILED") return { status: "FAILED", label: "Planning Failed" };
    return { status: "IDLE", label: "Standby" };
  };

  const getArchitectState = () => {
    if (missionStatus === "PLANNING" && tasks.length > 0) return { status: "WORKING", label: "Formulating Contracts" };
    if (tasks.some((t) => t.assignedRole === "ARCHITECT" && t.status === "RUNNING")) {
      return { status: "WORKING", label: `Specifying ${activeTaskId || "Architecture"}` };
    }
    if (tasks.some((t) => t.assignedRole === "ARCHITECT" && t.status === "COMPLETED") || tasks.length > 0) {
      return { status: "SUCCESS", label: "Architecture Sealed" };
    }
    return { status: "IDLE", label: "Standby" };
  };

  const getBuilderState = () => {
    if (runningTasks > 0 || activeAgent === "BUILDER") {
      return { status: "WORKING", label: `Building [Slot Active: ${activeTaskId || "task"}]` };
    }
    if (completedTasks > 0 && tasks.length === completedTasks) {
      return { status: "SUCCESS", label: `All ${completedTasks} Patches Generated` };
    }
    if (tasks.some((t) => t.status === "REVISION_REQUIRED")) {
      return { status: "WORKING", label: "Refining with Sentinel feedback" };
    }
    if (tasks.length > 0) {
      return { status: "WAITING", label: `${completedTasks}/${tasks.length} Tasks Built` };
    }
    return { status: "IDLE", label: "Standby" };
  };

  const getSentinelState = () => {
    if (verifyingTasks > 0 || activeAgent === "SENTINEL") {
      return { status: "WORKING", label: `Auditing ${activeTaskId || "patch evidence"}` };
    }
    if (completedTasks === tasks.length && tasks.length > 0) {
      return { status: "SUCCESS", label: "All Unit Criteria Approved" };
    }
    if (tasks.some((t) => t.sentinelDecision === "REVISION_REQUIRED")) {
      return { status: "WAITING", label: "Revision feedback dispatched" };
    }
    return { status: "IDLE", label: "Monitoring" };
  };

  const getIntegratedQAState = () => {
    if (missionStatus === "VERIFYING") return { status: "WORKING", label: "Executing Zero-Bypass QA" };
    if (finalResult?.integratedQA?.success || missionStatus === "COMPLETED") {
      return { status: "SUCCESS", label: "QA Passed · Sealed" };
    }
    if (finalResult?.integratedQA && !finalResult.integratedQA.success) {
      return { status: "FAILED", label: "QA Check Failed" };
    }
    if (missionStatus === "EXECUTING") return { status: "WAITING", label: "Awaiting all patches" };
    return { status: "IDLE", label: "Gate Locked" };
  };

  const commander = getCommanderState();
  const architect = getArchitectState();
  const builder = getBuilderState();
  const sentinel = getSentinelState();
  const qa = getIntegratedQAState();

  const stages = [
    {
      id: "commander",
      name: "COMMANDER",
      role: "Strategy & DAG",
      icon: Compass,
      color: "text-indigo-400",
      bgColor: "bg-indigo-500/10",
      borderColor: "border-indigo-500/20",
      activeBorder: "border-indigo-500",
      state: commander,
    },
    {
      id: "architect",
      name: "ARCHITECT",
      role: "Interfaces & Schemas",
      icon: FileCode2,
      color: "text-sky-400",
      bgColor: "bg-sky-500/10",
      borderColor: "border-sky-500/20",
      activeBorder: "border-sky-500",
      state: architect,
    },
    {
      id: "builder",
      name: "BUILDERS",
      role: "Isolated Code Gen",
      icon: Hammer,
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/20",
      activeBorder: "border-amber-500",
      state: builder,
    },
    {
      id: "sentinel",
      name: "SENTINEL",
      role: "QA Gatekeeper",
      icon: ShieldAlert,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/20",
      activeBorder: "border-emerald-500",
      state: sentinel,
    },
    {
      id: "integrated-qa",
      name: "INTEGRATED QA",
      role: "Canonical Verification",
      icon: ShieldCheck,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
      borderColor: "border-purple-500/20",
      activeBorder: "border-purple-500",
      state: qa,
    },
  ];

  return (
    <div className="w-full bg-surface rounded-xl border border-border p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-accent" />
          <h3 className="text-xs font-mono font-semibold tracking-wider text-foreground uppercase">
            Autonomous Swarm Pipeline
          </h3>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-mutedForeground">
          <span>Active Coordinator:</span>
          <span className="text-accent font-semibold px-2 py-0.5 rounded bg-accent/10 border border-accent/20">
            {activeAgent || "IDLE"}
          </span>
        </div>
      </div>

      {/* Grid of pipeline stages */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
        {stages.map((stage, idx) => {
          const Icon = stage.icon;
          const isWorking = stage.state.status === "WORKING";
          const isSuccess = stage.state.status === "SUCCESS";
          const isFailed = stage.state.status === "FAILED";
          const isWaiting = stage.state.status === "WAITING";

          return (
            <div
              key={stage.id}
              className={clsx(
                "relative rounded-lg p-3.5 border transition-all duration-300 flex flex-col justify-between",
                stage.bgColor,
                isWorking
                  ? `${stage.activeBorder} shadow-[0_0_15px_rgba(59,130,246,0.15)] ring-1 ring-accent/30`
                  : stage.borderColor,
                "bg-surfaceRaised/80 hover:bg-surfaceRaised"
              )}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={clsx(
                        "w-7 h-7 rounded-md flex items-center justify-center border",
                        stage.borderColor,
                        stage.bgColor,
                        stage.color
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-mono font-bold text-foreground">
                        {stage.name}
                      </div>
                      <div className="text-[10px] font-mono text-mutedForeground">
                        {stage.role}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isWorking && (
                      <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent/20 text-accent font-semibold animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        RUN
                      </span>
                    )}
                    {isSuccess && (
                      <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-success/20 text-success font-semibold">
                        <CheckCircle2 className="w-3 h-3" />
                        PASS
                      </span>
                    )}
                    {isFailed && (
                      <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-danger/20 text-danger font-semibold">
                        <XCircle className="w-3 h-3" />
                        FAIL
                      </span>
                    )}
                    {isWaiting && (
                      <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-surfaceOverlay text-mutedForeground">
                        <Clock className="w-3 h-3" />
                        WAIT
                      </span>
                    )}
                    {!isWorking && !isSuccess && !isFailed && !isWaiting && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surfaceOverlay text-mutedForeground/60">
                        IDLE
                      </span>
                    )}
                  </div>
                </div>

                {/* Subtitle / Activity Message */}
                <p className="text-[11px] font-mono text-mutedForeground line-clamp-2 mt-1 min-h-[2rem]">
                  {stage.state.label}
                </p>
              </div>

              {/* Progress Bar / Indicator */}
              <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[10px] font-mono text-mutedForeground">
                <span>Stage {idx + 1} of 5</span>
                {isWorking && <span className="text-accent font-medium">Processing...</span>}
                {isSuccess && <span className="text-success font-medium">Completed</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
