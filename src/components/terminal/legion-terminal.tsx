"use client";

import React, { useState, useRef, useEffect } from "react";
import { Terminal, Copy, Trash2, Pause, Play, Check, Filter } from "lucide-react";
import { useTerminalSlice } from "@/stores/terminal-slice";
import { useMissionRuntimeStore } from "@/stores/mission-runtime-store";

export const LegionTerminal: React.FC = () => {
  const terminalLogs = useTerminalSlice((s) => s.terminalLogs);
  const clearTerminal = useTerminalSlice((s) => s.clearTerminal);
  const runtimeEvents = useMissionRuntimeStore((s) => s.events);

  const [activeFilter, setActiveFilter] = useState<"ALL" | "COMMANDER" | "BUILDER" | "SENTINEL" | "SYSTEM">("ALL");
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Combine terminal logs & runtime stream events
  const combinedLogs = [
    ...terminalLogs.map((l) => ({
      id: l.id,
      timestamp: l.timestamp.includes("T") ? l.timestamp.slice(11, 19) : l.timestamp,
      stream: l.stream,
      role: l.stream === "COMMAND" ? "COMMANDER" : l.stream === "SYSTEM" ? "SYSTEM" : "ORCHESTRATOR",
      text: l.text,
    })),
    ...runtimeEvents.map((e) => ({
      id: e.id,
      timestamp: e.formattedTime || "00:00:00",
      stream: e.type.includes("ERROR") || e.type.includes("FAIL") ? "STDERR" : e.type.includes("PASS") || e.type.includes("COMPLETED") ? "SUCCESS" : "STDOUT",
      role: e.agentRole || "ORCHESTRATOR",
      text: `[${e.agentRole || "ORCHESTRATOR"}] ${e.type}: ${e.message || ""}`,
    })),
  ];

  const filteredLogs = combinedLogs.filter((log) => {
    if (activeFilter === "ALL") return true;
    if (activeFilter === "COMMANDER") return log.role === "COMMANDER" || log.text.includes("COMMANDER");
    if (activeFilter === "BUILDER") return log.role === "BUILDER" || log.text.includes("BUILDER");
    if (activeFilter === "SENTINEL") return log.role === "SENTINEL" || log.text.includes("SENTINEL");
    if (activeFilter === "SYSTEM") return log.role === "SYSTEM" || log.stream === "SYSTEM";
    return true;
  });

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs.length, autoScroll]);

  const handleCopy = async () => {
    const text = filteredLogs.map((l) => `[${l.timestamp}] [${l.stream}] ${l.text}`).join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStreamStyle = (stream: string) => {
    switch (stream) {
      case "COMMAND":
        return "text-accent font-semibold";
      case "STDERR":
        return "text-danger";
      case "SUCCESS":
        return "text-success font-semibold";
      case "WARNING":
        return "text-warning";
      case "SYSTEM":
        return "text-info";
      case "STDOUT":
      default:
        return "text-foreground/90";
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case "COMMANDER":
        return "text-commander bg-commander/10 border-commander/30";
      case "BUILDER":
        return "text-builder bg-builder/10 border-builder/30";
      case "SENTINEL":
        return "text-sentinel bg-sentinel/10 border-sentinel/30";
      default:
        return "text-mutedForeground bg-surfaceRaised border-border";
    }
  };

  return (
    <div className="bg-surface rounded-lg border border-border flex flex-col h-[380px] overflow-hidden">
      {/* Terminal Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-surfaceRaised border-b border-border">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-accent" />
          <span className="text-xs font-mono font-bold tracking-wider text-mutedForeground uppercase">
            LEGION LIVE STREAM & CONSOLE
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface border border-border text-mutedForeground">
            NDJSON / sandbox
          </span>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 text-[10px] font-mono">
          {(["ALL", "COMMANDER", "BUILDER", "SENTINEL", "SYSTEM"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-2 py-0.5 rounded transition-colors uppercase font-semibold ${
                activeFilter === f
                  ? "bg-accent text-white"
                  : "bg-surface hover:bg-surfaceOverlay text-mutedForeground hover:text-foreground border border-border"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1 border transition-colors ${
              autoScroll
                ? "bg-surface border-border text-foreground"
                : "bg-surfaceRaised border-warning/40 text-warning"
            }`}
            title={autoScroll ? "Pause autoscroll" : "Resume autoscroll"}
          >
            {autoScroll ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <span className="hidden sm:inline">{autoScroll ? "AUTOSCROLL" : "PAUSED"}</span>
          </button>

          <button
            onClick={handleCopy}
            className="p-1.5 rounded bg-surface hover:bg-surfaceOverlay border border-border text-mutedForeground hover:text-foreground transition-colors"
            title="Copy Filtered Output"
          >
            {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
          </button>

          <button
            onClick={clearTerminal}
            className="p-1.5 rounded bg-surface hover:bg-danger/20 border border-border hover:border-danger/40 text-mutedForeground hover:text-danger transition-colors"
            title="Clear Console"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Terminal Output */}
      <div
        ref={scrollRef}
        className="flex-1 p-3.5 overflow-y-auto font-mono text-xs space-y-1.5 bg-background select-text"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-mutedForeground italic text-[11px] py-4 text-center">
            Waiting for real-time telemetry from agent micro-VM sandbox...
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div key={`${log.id}-${index}`} className="flex items-start gap-2 leading-relaxed">
              <span className="text-[10px] text-mutedForeground shrink-0 select-none opacity-60">
                {log.timestamp}
              </span>
              <span className={`text-[9px] font-bold shrink-0 uppercase select-none px-1 py-0.2 rounded border ${getRoleBadgeStyle(log.role)}`}>
                {log.role}
              </span>
              <span className={`text-[9px] font-bold shrink-0 uppercase select-none px-1 rounded bg-surface border border-border ${getStreamStyle(log.stream)}`}>
                {log.stream}
              </span>
              <pre className={`whitespace-pre-wrap break-all flex-1 font-mono text-xs ${getStreamStyle(log.stream)}`}>
                {log.text}
              </pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
