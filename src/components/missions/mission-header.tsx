"use client";

import React, { useState, useEffect } from "react";
import { Play, Square, RotateCcw, Activity, ShieldCheck, Cpu, Terminal, Compass, Hammer, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status-dot";
import { useMissionRuntimeStore } from "@/stores/mission-runtime-store";
import { useMissionSlice } from "@/stores/mission-slice";

export const MissionHeader: React.FC = () => {
  const runtime = useMissionRuntimeStore();
  const missionSlice = useMissionSlice();

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const isRunning = runtime.status === "PLANNING" || runtime.status === "EXECUTING" || runtime.status === "VERIFYING";

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else if (runtime.status === "IDLE") {
      setElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, runtime.status]);

  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainingSecs = sec % 60;
    return `${mins}m ${remainingSecs < 10 ? "0" : ""}${remainingSecs}s`;
  };

  const getActiveRoleIcon = () => {
    switch (runtime.activeAgent) {
      case "COMMANDER":
        return <Compass className="w-3.5 h-3.5 text-commander" />;
      case "BUILDER":
        return <Hammer className="w-3.5 h-3.5 text-builder" />;
      case "SENTINEL":
        return <ShieldAlert className="w-3.5 h-3.5 text-sentinel" />;
      default:
        return <Cpu className="w-3.5 h-3.5 text-accent" />;
    }
  };

  return (
    <header className="border-b border-border bg-surface px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 select-none">
      {/* Left: Mission Identity & Live Telemetry */}
      <div className="flex items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold tracking-wider text-mutedForeground notranslate" translate="no" suppressHydrationWarning>
              LEGION
            </span>
            <span className="text-xs font-mono text-mutedForeground">/</span>
            <span className="text-xs font-mono font-bold text-foreground uppercase tracking-wide">
              {isRunning
                ? `MISSION // ${runtime.missionId ? runtime.missionId.slice(0, 8) : "ACTIVE"}`
                : "MISSION CONTROL"}
            </span>

            <Badge
              variant={
                isRunning
                  ? "accent"
                  : runtime.status === "COMPLETED"
                  ? "success"
                  : runtime.status === "FAILED"
                  ? "danger"
                  : "outline"
              }
              size="sm"
            >
              {isRunning ? "MISSION ACTIVE" : `SYSTEM // ${runtime.status}`}
            </Badge>
          </div>

          <div className="flex items-center gap-3 mt-1 text-xs font-mono text-mutedForeground">
            <div className="flex items-center gap-1.5">
              <StatusDot
                status={isRunning ? "WORKING" : runtime.status === "COMPLETED" ? "READY" : "IDLE"}
                pulse={isRunning}
              />
              <span className="font-bold text-foreground uppercase">
                {runtime.status === "IDLE" ? "STANDBY" : runtime.status}
              </span>
            </div>

            {isRunning && (
              <>
                <span>|</span>
                <div className="flex items-center gap-1.5 text-foreground">
                  {getActiveRoleIcon()}
                  <span className="font-semibold text-accent">{runtime.activeAgent || "ORCHESTRATOR"}:</span>
                  <span className="text-mutedForeground truncate max-w-[200px] sm:max-w-xs">
                    {runtime.activeAgentStatus || "Processing"}
                  </span>
                </div>
              </>
            )}

            <span>|</span>
            <div>
              Elapsed: <strong className="text-foreground">{formatElapsed(elapsedSeconds)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Tactical Action Controls */}
      <div className="flex items-center gap-2">
        {isRunning ? (
          <Button
            variant="danger"
            size="sm"
            onClick={runtime.cancelMission}
            icon={<Square className="w-3.5 h-3.5" />}
          >
            CANCEL MISSION
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={runtime.resetMission}
            icon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            RESET
          </Button>
        )}
      </div>
    </header>
  );
};
