"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  Sparkles,
  Sliders,
  Play,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  Clock,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { useMissionRuntimeStore } from "@/stores/mission-runtime-store";
import { useMissionHistoryStore } from "@/stores/mission-history-store";

export const NewMissionCard: React.FC = () => {
  const router = useRouter();
  const [prompt, setPrompt] = React.useState(
    "Create a TypeScript utility that calculates fibonacci numbers and verify it with automated tests."
  );
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [provider, setProvider] = React.useState("e2b");
  const [model, setModel] = React.useState("gemini-1.5-pro");
  const [concurrency, setConcurrency] = React.useState(2);
  const [failurePolicy, setFailurePolicy] = React.useState("FAIL_FAST");
  const [timeoutSeconds, setTimeoutSeconds] = React.useState(300);

  const startMission = useMissionRuntimeStore((s) => s.startMission);
  const runtimeStatus = useMissionRuntimeStore((s) => s.status);
  const addHistoryMission = useMissionHistoryStore((s) => s.addMission);

  const isRunning =
    runtimeStatus === "PLANNING" ||
    runtimeStatus === "EXECUTING" ||
    runtimeStatus === "VERIFYING";

  const handleStart = async () => {
    if (!prompt.trim() || isRunning) return;

    const missionId = `mission-${Date.now()}`;
    addHistoryMission({
      id: missionId,
      title: prompt.slice(0, 70),
      prompt: prompt.trim(),
      status: "PLANNING",
      createdAt: new Date().toISOString(),
      durationMs: 0,
      tasksCount: 0,
      qaResult: "NONE",
      provider: provider === "e2b" ? "E2B" : "MOCK",
      model: model === "gemini-1.5-pro" ? "Google Gemini 1.5 Pro" : "Claude 3.5 Sonnet",
      totalTokens: 0,
      totalCostUsd: 0,
      filesCount: 0,
    });

    // Start background stream execution
    startMission(prompt.trim());

    // Redirect to active mission control
    router.push(`/missions/${missionId}`);
  };

  return (
    <div id="new-mission" className="bg-surface rounded-xl border border-border p-5 space-y-4 shadow-sm font-mono">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-accent/15 border border-accent/30 text-accent flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">What should LEGION build?</h3>
            <p className="text-[11px] text-mutedForeground">
              Specify objective, requirements, and constraints for autonomous swarm execution.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-xs text-mutedForeground hover:text-foreground px-2.5 py-1 rounded bg-surfaceRaised border border-border transition-colors"
        >
          <Sliders className="w-3.5 h-3.5 text-accent" />
          <span>Advanced Config</span>
          {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Prominent Prompt Textarea */}
      <div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isRunning}
          rows={3}
          placeholder="e.g. Create a REST API for task management with authentication and PostgreSQL..."
          className="w-full p-3.5 rounded-lg bg-background border border-border text-foreground placeholder:text-mutedForeground/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-xs leading-relaxed transition-all resize-y"
        />
      </div>

      {/* Collapsible Advanced Options */}
      {showAdvanced && (
        <div className="p-4 rounded-lg bg-surfaceRaised/70 border border-border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          {/* Provider */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase text-mutedForeground font-semibold block">
              Sandbox Provider
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full p-2 rounded bg-surface border border-border text-foreground text-xs focus:outline-none focus:border-accent"
            >
              <option value="e2b">E2B Isolated Sandbox (Production)</option>
              <option value="mock">Local Deterministic Mock (Dev)</option>
            </select>
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase text-mutedForeground font-semibold block">
              LLM Orchestration Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full p-2 rounded bg-surface border border-border text-foreground text-xs focus:outline-none focus:border-accent"
            >
              <option value="gemini-1.5-pro">Google Gemini 1.5 Pro</option>
              <option value="claude-3-5-sonnet">Anthropic Claude 3.5 Sonnet</option>
              <option value="gpt-4o">OpenAI GPT-4o</option>
            </select>
          </div>

          {/* Concurrency Slots */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase text-mutedForeground font-semibold block">
              Max Parallel Slots
            </label>
            <select
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              className="w-full p-2 rounded bg-surface border border-border text-foreground text-xs focus:outline-none focus:border-accent"
            >
              <option value={1}>1 Worker (Sequential)</option>
              <option value={2}>2 Workers (Parallel DAG)</option>
              <option value={4}>4 Workers (High Throughput)</option>
            </select>
          </div>

          {/* Timeout */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase text-mutedForeground font-semibold block">
              Mission Budget Timeout
            </label>
            <select
              value={timeoutSeconds}
              onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
              className="w-full p-2 rounded bg-surface border border-border text-foreground text-xs focus:outline-none focus:border-accent"
            >
              <option value={60}>60 Seconds</option>
              <option value={180}>3 Minutes</option>
              <option value={300}>5 Minutes</option>
              <option value={600}>10 Minutes</option>
            </select>
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2 text-[11px] text-mutedForeground">
          <ShieldCheck className="w-4 h-4 text-success" />
          <span>Zero-Bypass Integrated QA enforced by default</span>
        </div>

        <button
          onClick={handleStart}
          disabled={isRunning || !prompt.trim()}
          className={clsx(
            "flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-md",
            isRunning
              ? "bg-muted text-mutedForeground cursor-not-allowed"
              : "bg-accent hover:bg-accent/90 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:scale-[1.02]"
          )}
        >
          <Play className="w-4 h-4 fill-current" />
          <span>{isRunning ? "MISSION IN PROGRESS..." : "START MISSION"}</span>
        </button>
      </div>
    </div>
  );
};
