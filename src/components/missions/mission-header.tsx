"use client";

import React from "react";
import { Play, Pause, Square, Terminal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { Badge } from "@/components/ui/badge";
import { useMissionStore } from "@/stores/mission-store";

export const MissionHeader: React.FC = () => {
  const {
    mission,
    elapsedSeconds,
    pauseMission,
    resumeMission,
    stopMission,
    startMission,
  } = useMissionStore();

  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainingSecs = sec % 60;
    return `${mins}m ${remainingSecs < 10 ? "0" : ""}${remainingSecs}s`;
  };

  return (
    <header className="border-b border-border bg-surface px-6 py-4 flex flex-wrap items-center justify-between gap-4">
      {/* Left: Mission Identity & Status */}
      <div className="flex items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold tracking-wider text-mutedForeground">
              LEGION / MISSION CONTROL
            </span>
            <span className="text-xs font-mono text-mutedForeground">/</span>
            <span className="text-xs font-mono font-semibold text-foreground uppercase">
              MISSION #001
            </span>
            <Badge variant="accent" size="sm">
              DEMO MODE
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex items-center gap-2">
              <StatusDot status={mission.status} pulse={mission.status === "RUNNING"} />
              <span className="text-xs font-mono font-bold tracking-wide text-foreground uppercase">
                {mission.status}
              </span>
            </div>
            <span className="text-xs font-mono text-mutedForeground">|</span>
            <div className="text-xs font-mono text-mutedForeground">
              elapsed: <span className="text-foreground font-semibold">{formatElapsed(elapsedSeconds)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Orchestration Controls */}
      <div className="flex items-center gap-2.5">
        {mission.status === "RUNNING" ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={pauseMission}
            icon={<Pause className="w-3.5 h-3.5" />}
          >
            PAUSE
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={resumeMission}
            icon={<Play className="w-3.5 h-3.5" />}
          >
            RESUME
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={stopMission}
          icon={<Square className="w-3.5 h-3.5 text-danger" />}
        >
          STOP
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={startMission}
          icon={<Sparkles className="w-3.5 h-3.5 text-accent" />}
        >
          RUN DEMO SIMULATION
        </Button>
      </div>
    </header>
  );
};
