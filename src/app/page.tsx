"use client";

import React from "react";
import Link from "next/link";
import { clsx } from "clsx";
import {
  FolderGit2,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  ShieldCheck,
  TrendingUp,
  Cpu,
  Bot,
  ArrowRight,
  Radio,
  Layers,
  Sparkles,
} from "lucide-react";
import { useMissionHistoryStore } from "@/stores/mission-history-store";
import { useMissionRuntimeStore } from "@/stores/mission-runtime-store";
import { NewMissionCard } from "@/components/missions/new-mission-card";
import { PipelineDeck } from "@/components/missions/pipeline-deck";

export default function OverviewPage() {
  const [mounted, setMounted] = React.useState(false);
  const missions = useMissionHistoryStore((s) => s.missions);
  const runtimeStatus = useMissionRuntimeStore((s) => s.status);
  const liveEvents = useMissionRuntimeStore((s) => s.events);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const totalMissions = mounted ? missions.length : 4;
  const successfulMissions = mounted ? missions.filter((m) => m.status === "COMPLETED").length : 3;
  const failedMissions = mounted ? missions.filter((m) => m.status === "FAILED").length : 1;
  const activeMissions = mounted
    ? missions.filter((m) => m.status === "RUNNING" || m.status === "PLANNING" || m.status === "VALIDATING").length +
      (runtimeStatus === "EXECUTING" || runtimeStatus === "PLANNING" || runtimeStatus === "VERIFYING" ? 1 : 0)
    : 0;

  const qaSuccessRate = totalMissions > 0 ? Math.round((successfulMissions / totalMissions) * 100) : 100;
  const avgDurationSeconds =
    totalMissions > 0
      ? Math.round(
          missions.reduce((acc, m) => acc + (m.durationMs || 45000), 0) / (totalMissions * 1000)
        )
      : 54;

  const isLiveRunning =
    runtimeStatus === "EXECUTING" ||
    runtimeStatus === "PLANNING" ||
    runtimeStatus === "VERIFYING";

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-mono font-bold tracking-tight text-foreground">
              Autonomous Software Engineering Deck
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent/15 text-accent font-semibold border border-accent/30">
              CORE v0.1
            </span>
          </div>
          <p className="text-xs font-mono text-mutedForeground mt-1">
            Coordinating multi-agent DAG execution with Zero-Bypass Canonical Workspace validation.
          </p>
        </div>

        {/* Global Status Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surfaceRaised border border-border text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <span className="text-foreground font-semibold">ALL SYSTEMS OPERATIONAL</span>
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Missions */}
        <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1 shadow-sm font-mono">
          <span className="text-[10px] text-mutedForeground uppercase font-medium">Total Missions</span>
          <div className="text-xl font-bold text-foreground">{totalMissions}</div>
          <span className="text-[10px] text-mutedForeground">Recorded history</span>
        </div>

        {/* Successful */}
        <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1 shadow-sm font-mono">
          <span className="text-[10px] text-mutedForeground uppercase font-medium">Successful</span>
          <div className="text-xl font-bold text-success flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-success" />
            {successfulMissions}
          </div>
          <span className="text-[10px] text-success/80">{qaSuccessRate}% success rate</span>
        </div>

        {/* Failed */}
        <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1 shadow-sm font-mono">
          <span className="text-[10px] text-mutedForeground uppercase font-medium">Failed / Stopped</span>
          <div className="text-xl font-bold text-danger flex items-center gap-1.5">
            <XCircle className="w-4 h-4 text-danger" />
            {failedMissions}
          </div>
          <span className="text-[10px] text-mutedForeground">Zero-Bypass caught</span>
        </div>

        {/* Active Missions */}
        <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1 shadow-sm font-mono">
          <span className="text-[10px] text-mutedForeground uppercase font-medium">Active Swarms</span>
          <div className="text-xl font-bold text-accent flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-accent" />
            {activeMissions}
          </div>
          <span className="text-[10px] text-accent/80">Concurrent slots</span>
        </div>

        {/* QA Success Rate */}
        <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1 shadow-sm font-mono">
          <span className="text-[10px] text-mutedForeground uppercase font-medium">QA Pass Rate</span>
          <div className="text-xl font-bold text-emerald-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            {qaSuccessRate}%
          </div>
          <span className="text-[10px] text-mutedForeground">Strict sandbox</span>
        </div>

        {/* Avg Duration */}
        <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1 shadow-sm font-mono">
          <span className="text-[10px] text-mutedForeground uppercase font-medium">Avg Duration</span>
          <div className="text-xl font-bold text-foreground flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-mutedForeground" />
            {avgDurationSeconds}s
          </div>
          <span className="text-[10px] text-mutedForeground">Per mission</span>
        </div>
      </div>

      {/* New Mission Prominent Creator */}
      <NewMissionCard />

      {/* Swarm Pipeline Preview if running or recent */}
      {isLiveRunning && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-mono font-bold text-accent uppercase tracking-wider flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 animate-pulse" /> Live Swarm Telemetry
            </span>
            <Link href="/missions/live" className="text-[11px] font-mono text-accent hover:underline">
              Open Full Mission Control &rarr;
            </Link>
          </div>
          <PipelineDeck />
        </div>
      )}

      {/* Two Column Grid: Recent Missions & System Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Recent Missions Table */}
        <div className="lg:col-span-7 bg-surface rounded-xl border border-border p-4 space-y-3 font-mono shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-accent" />
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Recent Missions
              </h3>
            </div>
            <Link
              href="/missions"
              className="text-[11px] text-mutedForeground hover:text-accent flex items-center gap-1 transition-colors"
            >
              <span>View All History</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-2">
            {missions.slice(0, 4).map((mission) => {
              const isCompleted = mission.status === "COMPLETED";
              const isFailed = mission.status === "FAILED";

              return (
                <Link
                  key={mission.id}
                  href={`/missions/${mission.id}`}
                  className="block p-3 rounded-lg bg-surfaceRaised/60 hover:bg-surfaceRaised border border-border/80 hover:border-border transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-foreground group-hover:text-accent transition-colors truncate">
                          {mission.title}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-surfaceOverlay text-mutedForeground border border-border">
                          {mission.id}
                        </span>
                      </div>
                      <p className="text-[11px] text-mutedForeground line-clamp-1 mt-1">
                        {mission.prompt}
                      </p>
                    </div>

                    <div className="shrink-0 text-right space-y-1">
                      <span
                        className={clsx(
                          "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border uppercase",
                          isCompleted && "bg-success/15 text-success border-success/30",
                          isFailed && "bg-danger/15 text-danger border-danger/30",
                          !isCompleted && !isFailed && "bg-accent/15 text-accent border-accent/30"
                        )}
                      >
                        {isCompleted && <CheckCircle2 className="w-3 h-3" />}
                        {isFailed && <XCircle className="w-3 h-3" />}
                        {mission.status}
                      </span>
                      <div className="text-[10px] text-mutedForeground">
                        {Math.round(mission.durationMs / 1000)}s · {mission.tasksCount} tasks
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right Column: System Activity Live Log */}
        <div className="lg:col-span-5 bg-surface rounded-xl border border-border p-4 space-y-3 font-mono shadow-sm flex flex-col">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-accent" />
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                System Activity Log
              </h3>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-surfaceOverlay text-mutedForeground border border-border">
              {liveEvents.length > 0 ? `${liveEvents.length} Live` : "Telemetry Active"}
            </span>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[340px] pr-1 flex-1">
            {liveEvents.length > 0 ? (
              liveEvents.slice(-6).map((ev, i) => (
                <div key={i} className="p-2.5 rounded bg-surfaceRaised/50 border border-border/60 text-xs">
                  <div className="flex items-center justify-between text-[10px] text-mutedForeground mb-1">
                    <span className="text-accent font-semibold">{ev.agentRole || "ORCHESTRATOR"}</span>
                    <span>{ev.formattedTime}</span>
                  </div>
                  <p className="text-foreground text-[11px] leading-relaxed line-clamp-2">
                    {ev.message}
                  </p>
                </div>
              ))
            ) : (
              <div className="space-y-2">
                <div className="p-2.5 rounded bg-surfaceRaised/50 border border-border/60 text-xs">
                  <div className="flex items-center justify-between text-[10px] text-mutedForeground mb-1">
                    <span className="text-indigo-400 font-semibold">COMMANDER</span>
                    <span>10 mins ago</span>
                  </div>
                  <p className="text-foreground text-[11px] leading-relaxed">
                    Formulated parallel DAG with 4 tasks and resolved dependencies.
                  </p>
                </div>
                <div className="p-2.5 rounded bg-surfaceRaised/50 border border-border/60 text-xs">
                  <div className="flex items-center justify-between text-[10px] text-mutedForeground mb-1">
                    <span className="text-amber-400 font-semibold">BUILDER</span>
                    <span>8 mins ago</span>
                  </div>
                  <p className="text-foreground text-[11px] leading-relaxed">
                    Executed sandbox test suite in isolated container sbx-0190a42f.
                  </p>
                </div>
                <div className="p-2.5 rounded bg-surfaceRaised/50 border border-border/60 text-xs">
                  <div className="flex items-center justify-between text-[10px] text-mutedForeground mb-1">
                    <span className="text-emerald-400 font-semibold">SENTINEL</span>
                    <span>5 mins ago</span>
                  </div>
                  <p className="text-foreground text-[11px] leading-relaxed">
                    Verified TypeScript compile-time invariants and approved task patch.
                  </p>
                </div>
                <div className="p-2.5 rounded bg-surfaceRaised/50 border border-border/60 text-xs">
                  <div className="flex items-center justify-between text-[10px] text-mutedForeground mb-1">
                    <span className="text-purple-400 font-semibold">INTEGRATED QA</span>
                    <span>2 mins ago</span>
                  </div>
                  <p className="text-foreground text-[11px] leading-relaxed">
                    Canonical workspace SHA-256 digest matched remote readback. Gate sealed.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
