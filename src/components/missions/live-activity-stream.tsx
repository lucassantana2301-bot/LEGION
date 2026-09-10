"use client";

import React from "react";
import { clsx } from "clsx";
import {
  Terminal,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Radio,
  Clock,
  Filter,
  ArrowDown,
  Layers,
  ShieldCheck,
  Cpu,
  Search,
} from "lucide-react";
import { useMissionRuntimeStore, LiveStreamEvent } from "@/stores/mission-runtime-store";

export const LiveActivityStream: React.FC = () => {
  const events = useMissionRuntimeStore((s) => s.events);
  const missionStatus = useMissionRuntimeStore((s) => s.status);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [filterRole, setFilterRole] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [autoScroll, setAutoScroll] = React.useState<boolean>(true);

  React.useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  const filteredEvents = events.filter((ev) => {
    if (filterRole !== "ALL") {
      if (filterRole === "COMMANDER" && ev.agentRole !== "COMMANDER" && !ev.type.includes("PLAN")) return false;
      if (filterRole === "BUILDER" && ev.agentRole !== "BUILDER" && !ev.type.includes("TASK")) return false;
      if (filterRole === "SENTINEL" && ev.agentRole !== "SENTINEL" && !ev.type.includes("REVIEW")) return false;
      if (filterRole === "QA" && !ev.type.includes("QA") && !ev.type.includes("TEST")) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const title = ((ev.data as Record<string, unknown> | undefined)?.title as string) || "";
      const msg = ev.message?.toLowerCase() || "";
      const type = ev.type?.toLowerCase() || "";
      return title.toLowerCase().includes(q) || msg.includes(q) || type.includes(q);
    }
    return true;
  });

  const getEventBadge = (ev: LiveStreamEvent) => {
    if (ev.type.includes("FAILED") || ev.type.includes("ERROR")) {
      return "bg-danger/20 text-danger border-danger/30";
    }
    if (ev.type.includes("COMPLETED") || ev.type.includes("PASSED") || ev.type.includes("SUCCESS")) {
      return "bg-success/20 text-success border-success/30";
    }
    if (ev.type.includes("STARTED") || ev.type.includes("WORKING") || ev.type.includes("PLANNING")) {
      return "bg-accent/20 text-accent border-accent/30";
    }
    if (ev.type.includes("REVIEW") || ev.type.includes("VERIFY")) {
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    }
    return "bg-surfaceOverlay text-mutedForeground border-border";
  };

  return (
    <div className="bg-surface rounded-xl border border-border flex flex-col h-[580px] shadow-sm font-mono text-xs">
      {/* Feed Header & Filters */}
      <div className="p-3.5 border-b border-border bg-surfaceRaised/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-accent animate-pulse" />
            <span className="font-bold text-foreground uppercase tracking-wider">
              Live Activity Stream
            </span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-surfaceOverlay border border-border text-mutedForeground">
            {events.length} Events Logged
          </span>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-mutedForeground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter logs..."
              className="pl-8 pr-2.5 py-1 text-[11px] rounded bg-surface border border-border text-foreground placeholder:text-mutedForeground/60 focus:outline-none focus:border-accent w-36 sm:w-44"
            />
          </div>

          {/* Role Filter Tabs */}
          <div className="flex items-center bg-surface border border-border rounded p-0.5">
            {["ALL", "COMMANDER", "BUILDER", "SENTINEL", "QA"].map((role) => (
              <button
                key={role}
                onClick={() => setFilterRole(role)}
                className={clsx(
                  "px-2 py-0.5 text-[10px] rounded transition-all",
                  filterRole === role
                    ? "bg-accent text-white font-bold"
                    : "text-mutedForeground hover:text-foreground"
                )}
              >
                {role}
              </button>
            ))}
          </div>

          {/* Auto scroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={clsx(
              "px-2 py-1 text-[10px] rounded border transition-all flex items-center gap-1",
              autoScroll
                ? "bg-accent/15 border-accent/30 text-accent font-semibold"
                : "bg-surface border-border text-mutedForeground"
            )}
          >
            <ArrowDown className="w-3 h-3" />
            Auto-scroll
          </button>
        </div>
      </div>

      {/* Events Log List */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 select-text">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-20 text-mutedForeground">
            <Activity className="w-8 h-8 text-mutedForeground/30 mx-auto mb-2" />
            <p>No activity events match your filter criteria.</p>
          </div>
        ) : (
          filteredEvents.map((ev, i) => (
            <div
              key={i}
              className="p-2.5 rounded bg-surfaceRaised/50 hover:bg-surfaceRaised border border-border/60 transition-colors flex items-start gap-3"
            >
              {/* Event Time & Sequence */}
              <div className="flex flex-col items-start shrink-0 text-[10px] text-mutedForeground pt-0.5 w-16">
                <span>{ev.formattedTime}</span>
                {ev.seq && <span className="text-[9px] text-mutedForeground/60">#{ev.seq}</span>}
              </div>

              {/* Event Body */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span
                    className={clsx(
                      "text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase",
                      getEventBadge(ev)
                    )}
                  >
                    {ev.type}
                  </span>

                  {ev.agentRole && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-surfaceOverlay text-accent font-mono border border-border">
                      {ev.agentRole}
                    </span>
                  )}

                  {ev.taskId && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-surfaceOverlay text-mutedForeground font-mono border border-border">
                      {ev.taskId}
                    </span>
                  )}

                  {Boolean((ev.data as Record<string, unknown> | undefined)?.title) && (
                    <span className="text-foreground font-semibold truncate text-[11px]">
                      {String((ev.data as Record<string, unknown>).title)}
                    </span>
                  )}
                </div>

                <p className="text-foreground/90 text-xs leading-relaxed whitespace-pre-wrap break-words">
                  {ev.message}
                </p>

                {/* Additional Event Telemetry Details if present */}
                {ev.data && Object.keys(ev.data).length > 0 && (
                  <details className="mt-1.5 pt-1 border-t border-border/40 text-[10px] text-mutedForeground">
                    <summary className="cursor-pointer hover:text-accent select-none">
                      View Event Data Payload
                    </summary>
                    <pre className="mt-1 p-2 rounded bg-background/80 border border-border text-[10px] overflow-x-auto text-mutedForeground">
                      {JSON.stringify(ev.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
