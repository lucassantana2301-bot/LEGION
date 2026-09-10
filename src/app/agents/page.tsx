"use client";

import React from "react";
import {
  Bot,
  Compass,
  FileCode2,
  Hammer,
  ShieldAlert,
  Cpu,
  CheckCircle2,
  Layers,
  Terminal,
  ShieldCheck,
} from "lucide-react";

export default function AgentsPage() {
  const agents = [
    {
      id: "commander",
      name: "COMMANDER",
      title: "Mission Orchestration & DAG Formulator",
      icon: Compass,
      color: "text-indigo-400",
      bgColor: "bg-indigo-500/10",
      borderColor: "border-indigo-500/30",
      description:
        "Decomposes high-level user mission prompts into a Directed Acyclic Graph (DAG) of discrete engineering tasks with explicit dependency resolution and complexity estimation.",
      responsibilities: [
        "Analyzes requirements and project constraints",
        "Formulates parallel execution DAGs with strict dependencies",
        "Breaks infinite failure loops and adjusts strategy dynamically",
        "Emits MISSION_PLANNING and PLAN_READY events",
      ],
      assignedTools: ["MissionPlanner", "DAGOptimizer", "MemoryQuery", "TaskDispatcher"],
      model: "Google Gemini 1.5 Pro",
    },
    {
      id: "architect",
      name: "ARCHITECT",
      title: "System Design & Interface Contractor",
      icon: FileCode2,
      color: "text-sky-400",
      bgColor: "bg-sky-500/10",
      borderColor: "border-sky-500/30",
      description:
        "Formulates explicit interface definitions, TypeScript types, database schemas, and architectural boundaries before any implementation code is generated.",
      responsibilities: [
        "Specifies type-safe interface contracts and schemas",
        "Validates modular separation and prevents monolithic coupling",
        "Registers architectural decisions into shared mission memory",
        "Identifies technical risks and mitigation plans",
      ],
      assignedTools: ["SchemaValidator", "TypeExtractor", "ContractSealer", "RiskAuditor"],
      model: "Google Gemini 1.5 Pro",
    },
    {
      id: "builder",
      name: "BUILDER",
      title: "Full-Stack Implementation in Isolated Sandbox",
      icon: Hammer,
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/30",
      description:
        "Generates code, runs terminal builds, and executes unit tests exclusively inside isolated micro-VM sandboxes. Emits structured TaskPatches to the orchestrator.",
      responsibilities: [
        "Writes implementation files and unit tests",
        "Executes build commands and inspects sandbox stdout/stderr",
        "Produces atomic, generation-bound TaskPatches",
        "Gathers real execution command telemetry",
      ],
      assignedTools: ["E2BSandbox", "CommandRunner", "PatchGenerator", "ReadbackValidator"],
      model: "Google Gemini 1.5 Pro",
    },
    {
      id: "sentinel",
      name: "SENTINEL",
      title: "Zero-Bypass Quality Gatekeeper & Verifier",
      icon: ShieldAlert,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/30",
      description:
        "Audits every Builder patch against real sandbox telemetry, enforces acceptance criteria, rejects regressions, and triggers revisions or approves canonical integration.",
      responsibilities: [
        "Verifies real execution evidence and exit codes",
        "Evaluates explicit success criteria with zero tolerance for hallucinations",
        "Identifies defects and provides structured feedback for revisions",
        "Approves atomic integration into Canonical Workspace",
      ],
      assignedTools: ["EvidenceEvaluator", "CriteriaAuditor", "DefectTracker", "IntegrationApprover"],
      model: "Google Gemini 1.5 Pro",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-7xl mx-auto w-full font-mono">
      {/* Header */}
      <div className="pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-accent" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Autonomous Swarm Agents
          </h1>
        </div>
        <p className="text-xs text-mutedForeground mt-1">
          Specialized autonomous AI agents collaborating under strict role separation and Zero-Bypass verification contracts.
        </p>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {agents.map((agent) => {
          const Icon = agent.icon;
          return (
            <div
              key={agent.id}
              className={`rounded-xl border p-5 bg-surface space-y-4 shadow-sm hover:bg-surfaceRaised/50 transition-all ${agent.borderColor}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center border ${agent.borderColor} ${agent.bgColor} ${agent.color}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{agent.name}</h3>
                    <span className="text-[11px] text-mutedForeground block">{agent.title}</span>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-surfaceRaised border border-border text-foreground font-semibold">
                  ACTIVE
                </span>
              </div>

              <p className="text-xs text-foreground/90 leading-relaxed bg-surfaceRaised/60 p-3 rounded-lg border border-border/80">
                {agent.description}
              </p>

              {/* Responsibilities */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase text-mutedForeground font-semibold block">
                  Core Responsibilities
                </span>
                <ul className="space-y-1 text-xs">
                  {agent.responsibilities.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-foreground/90 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tools & Model Footer */}
              <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2 text-[10px]">
                <div className="flex items-center gap-1.5 text-mutedForeground">
                  <span>Tools:</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {agent.assignedTools.map((t) => (
                      <span key={t} className="px-1.5 py-0.2 rounded bg-surfaceRaised border border-border text-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-accent font-semibold">{agent.model}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
