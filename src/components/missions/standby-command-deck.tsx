"use client";

import React, { useState } from "react";
import { Play, Sparkles, Compass, Box, Hammer, ShieldAlert, Cpu, Terminal, ArrowRight, Layers } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMissionRuntimeStore } from "@/stores/mission-runtime-store";

export const StandbyCommandDeck: React.FC = () => {
  const { missionPrompt, setMissionPrompt, startMission, status } = useMissionRuntimeStore();
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const presets = [
    {
      title: "Fintech SaaS MVP",
      prompt: "Build a financial SaaS for small businesses with Next.js App Router, TypeScript strict mode, PostgreSQL relational schema with Drizzle ORM, and dashboard with metrics and audit logs.",
      tag: "FINTECH / NEXT.JS",
    },
    {
      title: "OAuth Auth & Session Engine",
      prompt: "Implement authentication and session management with secure cookie encryption, OAuth callback preservation, and JWT verification middleware.",
      tag: "SECURITY / AUTH",
    },
    {
      title: "Real-time Ledger & Analytics",
      prompt: "Develop financial transactions ledger and analytics dashboard with data grids, filter bars, export helpers, and real-time aggregations.",
      tag: "UI / ANALYTICS",
    },
    {
      title: "Sentinel Automated QA Suite",
      prompt: "Run automated integration tests, verify type safety, validate database concurrency, and enforce strict quality gatekeeper policies.",
      tag: "QA / GATEKEEPER",
    },
  ];

  const handleApplyPreset = (presetPrompt: string) => {
    setMissionPrompt(presetPrompt);
    setSelectedPreset(presetPrompt);
  };

  const handleStart = () => {
    if (missionPrompt.trim().length > 0) {
      startMission(missionPrompt);
    }
  };

  const isRunning = status !== "IDLE" && status !== "COMPLETED" && status !== "FAILED";

  if (isRunning) return null;

  return (
    <div className="space-y-4">
      {/* Tactical Hero Input Card */}
      <Card variant="raised" className="p-5 border-border bg-gradient-to-b from-surfaceRaised/80 to-surface relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-borderMuted mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-accent shadow-glow animate-pulse" />
            <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">
              MISSION CONTROL // DIRECTIVE DISPATCH
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="accent" size="sm">
              MULTI-AGENT RUNTIME
            </Badge>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-mutedForeground">
              E2B Micro-VM Ready
            </span>
          </div>
        </div>

        {/* Textarea Input */}
        <div className="space-y-3">
          <label className="text-xs font-mono text-mutedForeground flex items-center justify-between">
            <span>Define mission directive for Commander & Agent Fleet:</span>
            <span className="text-[10px] text-accent">Auto-DAG Planning Enabled</span>
          </label>

          <textarea
            value={missionPrompt}
            onChange={(e) => setMissionPrompt(e.target.value)}
            placeholder="e.g. Build a production SaaS application with Next.js, PostgreSQL schema, authentication, and Sentinel automated test validation..."
            rows={3}
            className="w-full rounded-lg bg-background border border-border focus:border-accent p-3.5 text-xs font-mono text-foreground placeholder:text-mutedForeground/50 focus:outline-none transition-all resize-none"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 text-xs font-mono text-mutedForeground">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span>Click a preset directive below or type custom requirements:</span>
            </div>

            <Button
              variant="primary"
              size="md"
              onClick={handleStart}
              disabled={!missionPrompt.trim()}
              icon={<Play className="w-4 h-4 fill-current" />}
            >
              DEPLOY MISSION // START AGENTS
            </Button>
          </div>
        </div>

        {/* Quick Presets Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-borderMuted">
          {presets.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleApplyPreset(preset.prompt)}
              className={`p-3 rounded-lg border text-left transition-all font-mono text-xs flex flex-col justify-between group ${
                missionPrompt === preset.prompt
                  ? "bg-accent/15 border-accent/40 text-foreground"
                  : "bg-surface hover:bg-surfaceRaised border-border hover:border-borderMuted text-mutedForeground hover:text-foreground"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold tracking-wider text-accent uppercase">
                    {preset.tag}
                  </span>
                  <ArrowRight className="w-3 h-3 text-mutedForeground group-hover:text-accent transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="font-semibold text-foreground text-xs">{preset.title}</div>
              </div>
              <div className="text-[11px] text-mutedForeground line-clamp-2 mt-2 opacity-80">
                {preset.prompt}
              </div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
};
