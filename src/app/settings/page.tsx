"use client";

import React from "react";
import {
  Settings,
  ShieldCheck,
  Cpu,
  Key,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Save,
  Radio,
} from "lucide-react";

export default function SettingsPage() {
  const [saved, setSaved] = React.useState(false);
  const [sandboxProvider, setSandboxProvider] = React.useState("e2b");
  const [llmProvider, setLlmProvider] = React.useState("gemini");
  const [failurePolicy, setFailurePolicy] = React.useState("FAIL_FAST");
  const [maxConcurrency, setMaxConcurrency] = React.useState(2);
  const [timeoutMinutes, setTimeoutMinutes] = React.useState(5);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl mx-auto w-full font-mono text-xs">
      {/* Header */}
      <div className="pb-3 border-b border-border flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-accent" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              LEGION Core Configuration
            </h1>
          </div>
          <p className="text-mutedForeground mt-1 text-[11px]">
            Configure isolated micro-VM sandboxes, LLM orchestrators, and Zero-Bypass runtime policies.
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-success/15 text-success border border-success/30 font-semibold text-[11px]">
          <ShieldCheck className="w-4 h-4" />
          <span>Zero-Bypass Ready</span>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. Sandbox Environment */}
        <div className="p-5 rounded-xl bg-surface border border-border space-y-4 shadow-sm">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Cpu className="w-4 h-4 text-accent" />
            <h3 className="text-xs font-bold uppercase text-foreground">
              Isolated Execution Sandbox
            </h3>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-mutedForeground uppercase font-semibold block mb-1">
                Active Sandbox Provider
              </label>
              <select
                value={sandboxProvider}
                onChange={(e) => setSandboxProvider(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:border-accent"
              >
                <option value="e2b">E2B Micro-VM (Trusted Server-Side Factory Registry)</option>
                <option value="mock">Local Deterministic Sandbox (Development Only)</option>
              </select>
            </div>

            <div className="p-3 rounded-lg bg-surfaceRaised border border-border/80 text-[11px] text-mutedForeground flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <span>
                In production runs, only providers registered inside the internal unforgeable <code className="text-foreground">WeakSet</code> are authorized to produce verified Integrated QA evidence.
              </span>
            </div>
          </div>
        </div>

        {/* 2. Autonomous LLM Provider */}
        <div className="p-5 rounded-xl bg-surface border border-border space-y-4 shadow-sm">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Key className="w-4 h-4 text-accent" />
            <h3 className="text-xs font-bold uppercase text-foreground">
              LLM Swarm Intelligence
            </h3>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-mutedForeground uppercase font-semibold block mb-1">
                Primary Reasoning Model
              </label>
              <select
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:border-accent"
              >
                <option value="gemini">Google Gemini 1.5 Pro (Configured via GEMINI_API_KEY)</option>
                <option value="anthropic">Anthropic Claude 3.5 Sonnet (ANTHROPIC_API_KEY)</option>
                <option value="openai">OpenAI GPT-4o (OPENAI_API_KEY)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 3. Concurrency & Failure Policies */}
        <div className="p-5 rounded-xl bg-surface border border-border space-y-4 shadow-sm">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Sliders className="w-4 h-4 text-accent" />
            <h3 className="text-xs font-bold uppercase text-foreground">
              Runtime Orchestration & Concurrency
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-mutedForeground uppercase font-semibold block mb-1">
                DAG Failure Policy
              </label>
              <select
                value={failurePolicy}
                onChange={(e) => setFailurePolicy(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:border-accent"
              >
                <option value="FAIL_FAST">FAIL_FAST (Abort DAG immediately on unrecoverable error)</option>
                <option value="CONTINUE_INDEPENDENT">CONTINUE_INDEPENDENT (Finish non-dependent tasks)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-mutedForeground uppercase font-semibold block mb-1">
                Default Concurrency Slots
              </label>
              <select
                value={maxConcurrency}
                onChange={(e) => setMaxConcurrency(Number(e.target.value))}
                className="w-full p-2.5 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:border-accent"
              >
                <option value={1}>1 Worker Slot (Sequential)</option>
                <option value={2}>2 Worker Slots (Parallel Balanced)</option>
                <option value={4}>4 Worker Slots (High Throughput)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {saved && (
            <span className="text-success text-xs font-semibold flex items-center gap-1.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4" /> Configuration Saved
            </span>
          )}
          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent hover:bg-accent/90 text-white font-bold text-xs transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)]"
          >
            <Save className="w-4 h-4" />
            <span>Save Preferences</span>
          </button>
        </div>
      </form>
    </div>
  );
}
