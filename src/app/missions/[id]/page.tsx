"use client";

import React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  Radio,
  Layers,
  Activity,
  ShieldCheck,
  FolderCode,
  Database,
  StopCircle,
  Copy,
  Check,
  Clock,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useMissionRuntimeStore } from "@/stores/mission-runtime-store";
import { useMissionHistoryStore } from "@/stores/mission-history-store";
import { PipelineDeck } from "@/components/missions/pipeline-deck";
import { ParallelDagView } from "@/components/missions/dag-view";
import { LiveActivityStream } from "@/components/missions/live-activity-stream";
import { IntegratedQaPanel } from "@/components/missions/integrated-qa-panel";
import { CanonicalWorkspaceViewer } from "@/components/missions/canonical-workspace-viewer";
import { MissionMemoryPanel } from "@/components/missions/mission-memory-panel";

export default function MissionControlPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id || "live";

  const [activeTab, setActiveTab] = React.useState<"dag" | "activity" | "qa" | "workspace" | "memory">("dag");
  const [copied, setCopied] = React.useState(false);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);

  const runtimeStatus = useMissionRuntimeStore((s) => s.status);
  const missionPrompt = useMissionRuntimeStore((s) => s.missionPrompt);
  const runtimeMissionId = useMissionRuntimeStore((s) => s.missionId);
  const startedAt = useMissionRuntimeStore((s) => s.startedAt);
  const completedAt = useMissionRuntimeStore((s) => s.completedAt);
  const totalTokens = useMissionRuntimeStore((s) => s.totalTokens);
  const totalCostUsd = useMissionRuntimeStore((s) => s.totalCostUsd);
  const cancelMission = useMissionRuntimeStore((s) => s.cancelMission);
  const startMission = useMissionRuntimeStore((s) => s.startMission);

  const historyMission = useMissionHistoryStore((s) => s.getMissionById(rawId));

  const isRunning =
    runtimeStatus === "PLANNING" ||
    runtimeStatus === "EXECUTING" ||
    runtimeStatus === "VERIFYING";

  // Live Timer
  React.useEffect(() => {
    if (!isRunning || !startedAt) return;
    const startMs = new Date(startedAt).getTime();
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startMs) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, startedAt]);

  const displayId = runtimeMissionId || historyMission?.id || rawId;
  const displayTitle = missionPrompt || historyMission?.title || "Autonomous Task Execution";
  const displayStatus = isRunning ? runtimeStatus : historyMission?.status || runtimeStatus || "COMPLETED";

  const handleCopyId = () => {
    navigator.clipboard.writeText(displayId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs = [
    { id: "dag", label: "Parallel DAG & Tasks", icon: Layers },
    { id: "activity", label: "Live Activity Feed", icon: Activity },
    { id: "qa", label: "Integrated QA Gate", icon: ShieldCheck },
    { id: "workspace", label: "Canonical Workspace", icon: FolderCode },
    { id: "memory", label: "Mission Memory", icon: Database },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-7xl mx-auto w-full font-mono">
      {/* Top Navigation Breadcrumbs & Actions */}
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-border text-xs">
        <Link
          href="/missions"
          className="flex items-center gap-1.5 text-mutedForeground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Missions</span>
        </Link>

        <div className="flex items-center gap-3">
          {isRunning ? (
            <button
              onClick={cancelMission}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-danger/15 hover:bg-danger/25 text-danger border border-danger/30 text-xs font-bold transition-all"
            >
              <StopCircle className="w-4 h-4" />
              <span>Cancel Mission</span>
            </button>
          ) : (
            <button
              onClick={() => startMission(displayTitle)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent/15 hover:bg-accent/25 text-accent border border-accent/30 text-xs font-bold transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Re-run Mission</span>
            </button>
          )}
        </div>
      </div>

      {/* Mission Hero Header Card */}
      <div className="bg-surface rounded-xl border border-border p-5 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span
                className={clsx(
                  "text-[10px] font-bold px-2.5 py-0.5 rounded border uppercase",
                  displayStatus === "COMPLETED" && "bg-success/15 text-success border-success/30",
                  displayStatus === "FAILED" && "bg-danger/15 text-danger border-danger/30",
                  (displayStatus === "RUNNING" || displayStatus === "EXECUTING" || displayStatus === "PLANNING" || displayStatus === "VERIFYING") &&
                    "bg-accent/20 text-accent border-accent/40 animate-pulse",
                  displayStatus === "CANCELLED" && "bg-surfaceOverlay text-mutedForeground border-border"
                )}
              >
                {displayStatus}
              </span>

              <div
                onClick={handleCopyId}
                className="flex items-center gap-1.5 text-xs text-mutedForeground bg-surfaceRaised px-2.5 py-0.5 rounded border border-border cursor-pointer hover:text-foreground transition-colors"
              >
                <span>ID: {displayId}</span>
                {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
              </div>
            </div>

            <h1 className="text-lg font-bold text-foreground leading-snug">
              {displayTitle}
            </h1>
          </div>

          {/* Telemetry Metrics Deck */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="p-2.5 rounded-lg bg-surfaceRaised border border-border text-center min-w-[90px]">
              <span className="text-[10px] text-mutedForeground block uppercase">Elapsed Time</span>
              <span className="text-xs font-bold text-foreground flex items-center justify-center gap-1 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-mutedForeground" />
                {isRunning ? `${elapsedSeconds}s` : historyMission ? `${Math.round(historyMission.durationMs / 1000)}s` : "42s"}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-surfaceRaised border border-border text-center min-w-[90px]">
              <span className="text-[10px] text-mutedForeground block uppercase">Tokens Used</span>
              <span className="text-xs font-bold text-accent mt-0.5 block">
                {totalTokens?.total ? totalTokens.total.toLocaleString() : historyMission ? historyMission.totalTokens.toLocaleString() : "14,850"}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-surfaceRaised border border-border text-center min-w-[90px]">
              <span className="text-[10px] text-mutedForeground block uppercase">Est. Cost</span>
              <span className="text-xs font-bold text-emerald-400 mt-0.5 block">
                ${totalCostUsd ? totalCostUsd.toFixed(4) : historyMission ? historyMission.totalCostUsd.toFixed(4) : "0.0148"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5-Stage Swarm Pipeline Visualizer */}
      <PipelineDeck />

      {/* Tab Navigation Deck */}
      <div className="border-b border-border flex items-center gap-2 overflow-x-auto pb-px">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={clsx(
                "flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap",
                isActive
                  ? "border-accent text-accent bg-accent/5"
                  : "border-transparent text-mutedForeground hover:text-foreground hover:bg-surfaceRaised/40"
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Display */}
      <div className="pt-2">
        {activeTab === "dag" && <ParallelDagView />}
        {activeTab === "activity" && <LiveActivityStream />}
        {activeTab === "qa" && <IntegratedQaPanel />}
        {activeTab === "workspace" && <CanonicalWorkspaceViewer />}
        {activeTab === "memory" && <MissionMemoryPanel />}
      </div>
    </div>
  );
}
