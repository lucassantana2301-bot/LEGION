"use client";

import React, { useRef, useEffect, useState } from "react";
import {
  Play,
  Square,
  RotateCcw,
  Sparkles,
  Bot,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Clock,
  Terminal,
  Layers,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { useMissionRuntimeStore, TaskStatusType } from "@/stores/mission-runtime-store";

export const LiveMissionControlCard: React.FC = () => {
  const {
    status,
    missionId,
    missionPrompt,
    activeAgent,
    activeAgentStatus,
    tasks,
    events,
    error,
    finalResult,
    memoryEntriesCount,
    memorySnapshot,
    setMissionPrompt,
    startMission,
    cancelMission,
    resetMission,
  } = useMissionRuntimeStore();

  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const isRunning = status === "PLANNING" || status === "EXECUTING" || status === "VERIFYING";

  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events, autoScroll]);

  const toggleTaskExpand = (taskId: string) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleCopyLogs = async () => {
    const text = events
      .map((e) => `[${e.formattedTime}] [${e.agentRole || "ORCHESTRATOR"}] ${e.type}: ${e.message || ""}`)
      .join("\n");
    await navigator.clipboard.writeText(text);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const getTaskStatusBadge = (taskStatus: TaskStatusType) => {
    switch (taskStatus) {
      case "COMPLETED":
        return <Badge variant="success">COMPLETED</Badge>;
      case "RUNNING":
        return <Badge variant="accent">RUNNING</Badge>;
      case "VERIFYING":
        return <Badge variant="warning">VERIFYING</Badge>;
      case "REVISION_REQUIRED":
        return <Badge variant="warning">REVISION REQUIRED</Badge>;
      case "FAILED":
        return <Badge variant="danger">FAILED</Badge>;
      case "READY":
        return <Badge variant="info">READY</Badge>;
      default:
        return <Badge variant="default">BACKLOG</Badge>;
    }
  };

  const getAgentColor = (role?: string | null) => {
    switch (role) {
      case "COMMANDER":
        return "text-purple-400 border-purple-800/40 bg-purple-950/20";
      case "BUILDER":
        return "text-cyan-400 border-cyan-800/40 bg-cyan-950/20";
      case "SENTINEL":
        return "text-amber-400 border-amber-800/40 bg-amber-950/20";
      case "ORCHESTRATOR":
        return "text-emerald-400 border-emerald-800/40 bg-emerald-950/20";
      default:
        return "text-muted border-border bg-surface";
    }
  };

  return (
    <Card className="border border-border bg-surface/95 backdrop-blur shadow-2xl p-5 space-y-6">
      {/* Top Header & Active Agent HUD */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center text-accent">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground tracking-tight">
                LEGION Mission Control — Real Runtime
              </h2>
              <Badge variant="outline" className="text-[10px] uppercase font-mono">
                Multi-Agent v3
              </Badge>
            </div>
            <p className="text-xs text-muted">
              Autonomous orchestration powered by Commander, Builder, and Sentinel agents.
            </p>
          </div>
        </div>

        {/* Active Agent Status Indicator */}
        <div className="flex items-center gap-3">
          <div
            className={`px-3 py-1.5 rounded-lg border flex items-center gap-2.5 ${getAgentColor(
              activeAgent
            )} transition-colors duration-300`}
          >
            <StatusDot
              status={
                isRunning
                  ? "RUNNING"
                  : status === "COMPLETED"
                  ? "COMPLETED"
                  : status === "FAILED"
                  ? "FAILED"
                  : status === "CANCELLED"
                  ? "CANCELLED"
                  : "IDLE"
              }
            />
            <div className="flex flex-col">
              <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">
                {activeAgent || "SYSTEM IDLE"}
              </span>
              <span className="text-xs font-mono font-medium">
                {activeAgentStatus || "Ready"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mission Input & Action Controls */}
      <div className="space-y-3">
        <div className="flex justify-between items-center text-xs">
          <label htmlFor="mission-prompt-input" className="font-mono text-muted uppercase tracking-wider">
            Mission Objective
          </label>
          <span className="text-[11px] font-mono text-muted/80">
            {missionPrompt.length} / 10,000 characters
          </span>
        </div>

        <div className="relative">
          <textarea
            id="mission-prompt-input"
            value={missionPrompt}
            onChange={(e) => setMissionPrompt(e.target.value)}
            disabled={isRunning}
            rows={3}
            className="w-full bg-surfaceRaised/80 border border-border rounded-lg p-3 text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent disabled:opacity-60 disabled:cursor-not-allowed resize-none transition-all placeholder:text-muted/60"
            placeholder="Describe the engineering mission objective in detail..."
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            {!isRunning ? (
              <Button
                onClick={() => startMission()}
                disabled={!missionPrompt.trim()}
                className="bg-accent hover:bg-accent/90 text-accent-foreground font-medium flex items-center gap-2 px-5 py-2 rounded-lg text-xs"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                EXECUTE MISSION
              </Button>
            ) : (
              <Button
                onClick={() => cancelMission()}
                variant="danger"
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs bg-red-600 hover:bg-red-700 text-white font-medium"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                CANCEL MISSION
              </Button>
            )}

            {(status === "COMPLETED" || status === "FAILED" || status === "CANCELLED") && (
              <Button
                onClick={() => resetMission()}
                variant="outline"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                NEW MISSION
              </Button>
            )}
          </div>

          {missionId && (
            <div className="text-xs font-mono text-muted flex items-center gap-2">
              <span className="text-muted/60">ID:</span>
              <span className="text-foreground select-all">{missionId}</span>
            </div>
          )}
        </div>
      </div>

      {/* Mission Memory Live Telemetry Bar */}
      {memoryEntriesCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2 rounded-lg bg-surfaceRaised/50 border border-border/80 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono text-accent font-semibold flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
              MISSION MEMORY
            </span>
            <Badge variant="outline" className="text-[10px] font-mono">
              {memoryEntriesCount} {memoryEntriesCount === 1 ? "ENTRY" : "ENTRIES"}
            </Badge>
          </div>

          {memorySnapshot && (
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-muted">
              <span>Architecture: <strong className="text-foreground">{memorySnapshot.architecturalDecisions?.length || memorySnapshot.archDecisionsCount || 0}</strong></span>
              <span>Implementation: <strong className="text-foreground">{memorySnapshot.implementationSummary?.length || memorySnapshot.implementationCount || 0}</strong></span>
              <span>QA: <strong className="text-foreground">{memorySnapshot.sentinelFindings?.length || memorySnapshot.sentinelFindingsCount || 0}</strong></span>
              <span>Issues: <strong className="text-foreground">{memorySnapshot.issues?.length || memorySnapshot.issuesCount || 0}</strong></span>
            </div>
          )}
        </div>
      )}

      {/* Final Success or Failure Banner */}
      {status === "COMPLETED" && (
        <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <div className="font-semibold text-sm text-emerald-200">
              Mission Completed Successfully
            </div>
            <p className="text-emerald-300/90 font-mono">
              {finalResult?.summary || "All tasks were executed and strictly verified by Sentinel QA."}
            </p>
            {finalResult && (
              <div className="flex flex-wrap gap-4 pt-2 text-[11px] text-emerald-400/80 font-mono">
                <span>Tasks: {Object.keys(finalResult.taskResults).length}</span>
                <span>Attempts: {finalResult.totalAttempts}</span>
                <span>Tokens: {finalResult.totalTokens.total}</span>
                <span>Cost: ${finalResult.totalCostUsd.toFixed(4)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {status === "FAILED" && (
        <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/30 text-red-300 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <div className="font-semibold text-sm text-red-200">
              Mission Execution Failed
            </div>
            <p className="text-red-300/90 font-mono">
              {error || "An error occurred during multi-agent execution."}
            </p>
          </div>
        </div>
      )}

      {/* Task Board & Live DAG View */}
      {tasks.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-semibold uppercase text-muted tracking-wider flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Mission Task Graph ({tasks.filter((t) => t.status === "COMPLETED").length}/{tasks.length} Completed)
            </h3>
          </div>

          <div className="space-y-2">
            {tasks.map((task) => {
              const isExpanded = expandedTaskIds.has(task.id);
              const hasFeedback = Boolean(task.sentinelIssues?.length || task.sentinelRecommendations?.length);

              return (
                <div
                  key={task.id}
                  className="rounded-lg border border-border/80 bg-surfaceRaised/60 p-3 text-xs space-y-2 transition-all hover:border-border"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-muted/70 font-semibold">{task.id}</span>
                      <span className="font-medium text-foreground">{task.title}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {task.assignedRole}
                      </Badge>
                      <Badge
                        variant={
                          task.priority === "CRITICAL"
                            ? "danger"
                            : task.priority === "HIGH"
                            ? "warning"
                            : "default"
                        }
                        className="text-[10px] font-mono"
                      >
                        {task.priority}
                      </Badge>
                      {getTaskStatusBadge(task.status)}
                      {task.attempts > 0 && (
                        <span className="text-[10px] font-mono text-muted">
                          [{task.attempts}/{task.maxAttempts}]
                        </span>
                      )}
                    </div>
                  </div>

                  {task.description && (
                    <p className="text-muted text-[11px] leading-relaxed">
                      {task.description}
                    </p>
                  )}

                  {/* Success Criteria List */}
                  {task.successCriteria && task.successCriteria.length > 0 && (
                    <div className="pt-1 text-[11px] text-muted space-y-1">
                      <div className="font-mono text-[10px] text-muted/60 uppercase">Acceptance Criteria:</div>
                      {task.successCriteria.map((sc, i) => (
                        <div key={i} className="flex items-center gap-1.5 font-mono text-[11px]">
                          <span className="text-accent">•</span>
                          <span>{sc}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Sentinel QA Feedback Section */}
                  {hasFeedback && (
                    <div className="pt-2 border-t border-border/40">
                      <button
                        type="button"
                        onClick={() => toggleTaskExpand(task.id)}
                        className="flex items-center gap-1.5 text-[11px] font-mono text-amber-400 hover:underline"
                      >
                        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        QA Review Feedback ({task.sentinelDecision})
                      </button>

                      {isExpanded && (
                        <div className="mt-2 p-3 rounded-lg bg-amber-950/20 border border-amber-500/30 text-amber-200 text-xs space-y-2">
                          {task.sentinelSummary && (
                            <p className="font-mono text-[11px] text-amber-300">
                              {task.sentinelSummary}
                            </p>
                          )}

                          {task.sentinelIssues && task.sentinelIssues.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                              <span className="font-mono text-[10px] text-amber-400 font-semibold uppercase">
                                Defects Identified:
                              </span>
                              {task.sentinelIssues.map((iss) => (
                                <div
                                  key={iss.id}
                                  className="p-2 rounded bg-black/40 border border-amber-500/20 text-[11px] space-y-1 font-mono"
                                >
                                  <div className="flex items-center gap-2">
                                    <Badge variant="danger" className="text-[9px] px-1.5 py-0">
                                      {iss.severity}
                                    </Badge>
                                    <span className="font-semibold text-amber-200">{iss.title}</span>
                                  </div>
                                  <p className="text-muted">{iss.description}</p>
                                  {iss.proposedFix && (
                                    <div className="text-emerald-400 text-[10px]">
                                      Fix: {iss.proposedFix}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live Event Terminal Log */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono font-semibold uppercase text-muted tracking-wider flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Live Event Stream ({events.length} events)
          </h3>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] font-mono text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-border bg-surface text-accent focus:ring-accent"
              />
              Auto-scroll
            </label>

            <Button
              onClick={handleCopyLogs}
              variant="outline"
              size="sm"
              className="h-6 text-[10px] font-mono px-2 flex items-center gap-1"
            >
              {copiedLogs ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copiedLogs ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        <div className="h-56 w-full rounded-lg bg-black/90 border border-border p-3 overflow-y-auto font-mono text-xs text-foreground/90 space-y-1 select-text">
          {events.length === 0 ? (
            <div className="text-muted/50 italic text-[11px]">
              Ready. Enter a mission objective and press Execute Mission to start real-time telemetry stream.
            </div>
          ) : (
            events.map((evt, idx) => (
              <div key={idx} className="flex items-start gap-2.5 leading-relaxed text-[11px] hover:bg-white/5 px-1 rounded">
                <span className="text-muted/60 shrink-0 select-none">
                  {evt.formattedTime}
                </span>
                <span
                  className={`shrink-0 font-semibold px-1 rounded text-[10px] ${
                    evt.agentRole === "COMMANDER"
                      ? "text-purple-400 bg-purple-950/40"
                      : evt.agentRole === "BUILDER"
                      ? "text-cyan-400 bg-cyan-950/40"
                      : evt.agentRole === "SENTINEL"
                      ? "text-amber-400 bg-amber-950/40"
                      : "text-emerald-400 bg-emerald-950/40"
                  }`}
                >
                  {evt.agentRole || "ORCHESTRATOR"}
                </span>
                <span className="text-muted/80 font-medium shrink-0">
                  {evt.type}
                </span>
                <span className="text-foreground/90 break-words flex-1">
                  {evt.message || (evt.data ? JSON.stringify(evt.data) : "")}
                </span>
              </div>
            ))
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </Card>
  );
};
