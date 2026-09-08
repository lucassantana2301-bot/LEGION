"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ChevronRight,
  Layers,
  Bot,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useMissionStore } from "@/stores/mission-store";

export default function HomePage() {
  const router = useRouter();
  const { startMission } = useMissionStore();

  const [prompt, setPrompt] = useState("");
  const [step, setStep] = useState<"INPUT" | "ANALYZING" | "PLAN_REVIEW">("INPUT");

  const suggestions = [
    "BUILD A FINANCIAL SAAS",
    "CREATE AN AUTHENTICATION SYSTEM",
    "BUILD A REST API",
    "ANALYZE A REPOSITORY",
  ];

  const recentMissions = [
    {
      id: "mission-001",
      title: "Financial SaaS with PostgreSQL, Authentication and Dashboard",
      status: "RUNNING",
      progress: 63,
      tasks: "12/19",
      updated: "2m ago",
    },
    {
      id: "mission-002",
      title: "Real-time Multi-tenant Invoicing API & Stripe Webhooks",
      status: "COMPLETED",
      progress: 100,
      tasks: "14/14",
      updated: "1d ago",
    },
  ];

  const handleStartMission = () => {
    if (!prompt.trim()) {
      setPrompt("Create a financial SaaS for small businesses with authentication, PostgreSQL and dashboard.");
    }
    setStep("ANALYZING");
    setTimeout(() => {
      setStep("PLAN_REVIEW");
    }, 1200);
  };

  const handleDeployLegion = () => {
    startMission();
    router.push("/missions/mission-001");
  };

  return (
    <div className="min-h-full bg-grid-pattern p-6 sm:p-12 flex flex-col items-center justify-center">
      <div className="w-full max-w-3xl space-y-8 animate-in fade-in duration-300">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surfaceRaised border border-border text-xs font-mono text-mutedForeground mb-2">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span>LEGION v1.0 // AUTONOMOUS SOFTWARE ENGINEERING</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground font-sans">
            WHAT DO YOU WANT TO BUILD?
          </h1>
          <p className="text-sm font-mono text-mutedForeground max-w-xl mx-auto">
            One Mission. Multiple Agents. Working Software.
          </p>
        </div>

        {/* STEP 1: Main Mission Input */}
        {step === "INPUT" && (
          <div className="space-y-4">
            <Card variant="raised" className="p-4 border-border shadow-2xl space-y-3">
              <div className="relative">
                <textarea
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe a product, feature or engineering mission (e.g. 'Build a financial SaaS with authentication, PostgreSQL and dashboard')..."
                  className="w-full bg-surface border border-border focus:border-accent rounded-lg p-3.5 text-sm font-mono text-foreground placeholder:text-mutedForeground focus:outline-none resize-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-1.5 text-xs font-mono text-mutedForeground">
                  <ShieldCheck className="w-3.5 h-3.5 text-success" />
                  <span>Sandbox Isolation & Gatekeeper Protection</span>
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleStartMission}
                  icon={<Zap className="w-4 h-4 text-white" />}
                >
                  START MISSION
                </Button>
              </div>
            </Card>

            {/* Suggestions Chips */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <span className="text-[11px] font-mono text-mutedForeground mr-1">Suggestions:</span>
              {suggestions.map((sug) => (
                <button
                  key={sug}
                  onClick={() => setPrompt(sug)}
                  className="text-xs font-mono px-3 py-1.5 rounded bg-surface hover:bg-surfaceRaised border border-border hover:border-accent/40 text-mutedForeground hover:text-foreground transition-all duration-150"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: Analyzing State */}
        {step === "ANALYZING" && (
          <Card variant="raised" className="p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-accent/15 border border-accent/30 mx-auto flex items-center justify-center animate-pulse">
              <Bot className="w-6 h-6 text-accent" />
            </div>
            <div>
              <div className="text-sm font-mono font-bold text-foreground uppercase tracking-wider">
                INITIALIZING LEGION
              </div>
              <div className="text-xs font-mono text-accent mt-1 flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
                COMMANDER: Analyzing mission requirements & formulating task graph...
              </div>
            </div>
          </Card>
        )}

        {/* STEP 3: Plan Review & Deploy Legion */}
        {step === "PLAN_REVIEW" && (
          <Card variant="raised" className="p-6 border-border space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <span className="text-[10px] font-mono font-bold text-accent uppercase tracking-wider">
                  COMMANDER // MISSION BRIEF
                </span>
                <h2 className="text-base font-semibold text-foreground mt-0.5">
                  Financial SaaS with PostgreSQL, Auth & Analytics
                </h2>
              </div>
              <Badge variant="accent" size="md">
                8 STAGES GENERATED
              </Badge>
            </div>

            {/* Generated Plan Stages */}
            <div className="space-y-2 font-mono text-xs">
              <div className="text-[10px] text-mutedForeground uppercase font-bold tracking-wider mb-2">
                Mission Execution Plan:
              </div>
              {[
                { step: "01", title: "Define system architecture & domain models", agent: "ARCHITECT" },
                { step: "02", title: "Initialize repository & configure environment", agent: "BUILDER" },
                { step: "03", title: "Configure PostgreSQL schema & Drizzle migrations", agent: "ARCHITECT" },
                { step: "04", title: "Implement authentication & session handlers", agent: "BUILDER" },
                { step: "05", title: "Build financial dashboard & ledger components", agent: "BUILDER" },
                { step: "06", title: "Create REST APIs & webhook listeners", agent: "BUILDER" },
                { step: "07", title: "Run Sentinel automated test & regression suite", agent: "SENTINEL" },
                { step: "08", title: "Validate production build & static export", agent: "COMMANDER" },
              ].map((item) => (
                <div
                  key={item.step}
                  className="flex items-center justify-between p-2.5 rounded bg-surface border border-border"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-accent font-bold text-[11px]">{item.step}</span>
                    <span className="text-foreground">{item.title}</span>
                  </div>
                  <Badge variant="outline" size="sm">
                    {item.agent}
                  </Badge>
                </div>
              ))}
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <Button variant="ghost" size="md" onClick={() => setStep("INPUT")}>
                EDIT MISSION PROMPT
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleDeployLegion}
                  icon={<ArrowRight className="w-4 h-4" />}
                >
                  DEPLOY LEGION
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Recent Missions */}
        <div className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-bold tracking-wider text-mutedForeground uppercase">
              RECENT MISSIONS
            </span>
          </div>

          <div className="space-y-2">
            {recentMissions.map((m) => (
              <div
                key={m.id}
                onClick={() => router.push(`/missions/${m.id}`)}
                className="p-3.5 rounded-lg bg-surface hover:bg-surfaceRaised border border-border hover:border-borderMuted flex items-center justify-between cursor-pointer transition-all group font-mono text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="text-accent font-bold">{m.id}</span>
                  <span className="text-foreground group-hover:text-white font-medium truncate max-w-md">
                    {m.title}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-mutedForeground">
                  <span>{m.tasks} tasks</span>
                  <Badge variant={m.status === "RUNNING" ? "accent" : "success"} size="sm">
                    {m.status}
                  </Badge>
                  <ChevronRight className="w-4 h-4 text-mutedForeground group-hover:text-foreground" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
