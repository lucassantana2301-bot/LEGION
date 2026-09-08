"use client";

import React, { useState, useRef, useEffect } from "react";
import { Terminal, Copy, Trash2, Pause, Play, Check } from "lucide-react";
import { useMissionStore } from "@/stores/mission-store";

export const LegionTerminal: React.FC = () => {
  const { terminalLogs, clearTerminal } = useMissionStore();
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [terminalLogs, autoScroll]);

  const handleCopy = () => {
    const text = terminalLogs.map((l) => `[${l.timestamp}] [${l.stream}] ${l.text}`).join("\n");
    navigator.clipboard.writeText(text);
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

  return (
    <div className="bg-surface rounded-lg border border-border flex flex-col h-[380px] overflow-hidden">
      {/* Terminal Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-surfaceRaised border-b border-border">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-accent" />
          <span className="text-xs font-mono font-bold tracking-wider text-mutedForeground uppercase">
            LEGION TERMINAL & STREAMS
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface border border-border text-mutedForeground">
            zsh / sandbox
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1.5 rounded text-[10px] font-mono flex items-center gap-1 border transition-colors ${
              autoScroll
                ? "bg-surface border-border text-foreground"
                : "bg-surfaceRaised border-warning/40 text-warning"
            }`}
            title={autoScroll ? "Pause autoscroll" : "Resume autoscroll"}
          >
            {autoScroll ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <span>{autoScroll ? "AUTOSCROLL" : "PAUSED"}</span>
          </button>

          <button
            onClick={handleCopy}
            className="p-1.5 rounded bg-surface hover:bg-surfaceOverlay border border-border text-mutedForeground hover:text-foreground transition-colors"
            title="Copy Terminal Output"
          >
            {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
          </button>

          <button
            onClick={clearTerminal}
            className="p-1.5 rounded bg-surface hover:bg-danger/20 border border-border hover:border-danger/40 text-mutedForeground hover:text-danger transition-colors"
            title="Clear Terminal"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Terminal View */}
      <div
        ref={scrollRef}
        className="flex-1 p-3.5 overflow-y-auto font-mono text-xs space-y-1.5 bg-background select-text"
      >
        {terminalLogs.length === 0 ? (
          <div className="text-mutedForeground italic text-[11px]">
            Waiting for terminal output from agent sandbox...
          </div>
        ) : (
          terminalLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 leading-relaxed">
              <span className="text-[10px] text-mutedForeground shrink-0 select-none opacity-60">
                {log.timestamp.includes("T") ? log.timestamp.slice(11, 19) : log.timestamp}
              </span>
              <span className={`text-[10px] font-bold shrink-0 uppercase select-none px-1 rounded bg-surface border border-border ${getStreamStyle(log.stream)}`}>
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
