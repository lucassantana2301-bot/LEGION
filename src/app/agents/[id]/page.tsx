"use client";

import React from "react";
import Link from "next/link";
import { Compass, Box, Hammer, ShieldAlert, Cpu, CheckCircle2, AlertTriangle, Layers, Clock, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status-dot";
import { Card } from "@/components/ui/card";
import { useAgentsSlice } from "@/stores/agents-slice";
import { AgentRole } from "@/types/domain";

export default function AgentProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const agents = useAgentsSlice((s) => s.agents);
  const rawRole = (params.id?.toUpperCase() || "COMMANDER") as AgentRole;
  const agent = agents[rawRole] || agents.COMMANDER;

  const agentIcons: Record<AgentRole, React.ElementType> = {
    COMMANDER: Compass,
    ARCHITECT: Box,
    BUILDER: Hammer,
    SENTINEL: ShieldAlert,
  };

  const Icon = agentIcons[agent.role] || Compass;

  return (
    <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full font-mono">
      {/* Back and Agent Header */}
      <div className="space-y-4">
        <Link
          href="/missions/mission-001"
          className="inline-flex items-center gap-1.5 text-xs text-mutedForeground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Mission Control</span>
        </Link>

        {/* Agent Profile Card */}
        <Card variant="raised" className="p-6 border-border">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-surfaceRaised border border-border flex items-center justify-center">
                <Icon className="w-6 h-6 text-accent" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold font-sans text-foreground">
                    {agent.name}
                  </h1>
                  <Badge variant="accent" size="sm">
                    {agent.role}
                  </Badge>
                </div>
                <p className="text-xs text-mutedForeground mt-0.5">
                  {agent.tagline}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded bg-surface border border-border">
              <StatusDot status={agent.status} pulse={agent.status === "WORKING"} />
              <span className="text-xs font-bold uppercase text-foreground">
                {agent.status}
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-xs">
            <div className="text-[10px] text-mutedForeground uppercase font-bold">
              Current Assignment:
            </div>
            <div className="p-3 rounded bg-surface border border-border text-foreground">
              {agent.currentTaskTitle || "Awaiting task distribution from Commander."}
            </div>
          </div>
        </Card>
      </div>

      {/* Capabilities & Limits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Capabilities */}
        <Card variant="default" className="p-5 space-y-4">
          <div className="text-xs font-bold uppercase text-mutedForeground tracking-wider">
            Agent Capabilities & Tool Access
          </div>
          <div className="space-y-2 text-xs">
            {agent.capabilities.map((cap, i) => (
              <div key={i} className="flex items-center gap-2 p-2.5 rounded bg-surfaceRaised border border-borderMuted">
                <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="text-foreground">{cap}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Execution Guardrails & Limits */}
        <Card variant="default" className="p-5 space-y-4">
          <div className="text-xs font-bold uppercase text-mutedForeground tracking-wider">
            Execution Limits & Guardrails
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded bg-surfaceRaised border border-borderMuted">
              <span className="text-mutedForeground">Max Retries / Circuit Breaker</span>
              <span className="text-foreground font-bold">{agent.limits.maxRetries} Attempts</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded bg-surfaceRaised border border-borderMuted">
              <span className="text-mutedForeground">Token Budget Allocation</span>
              <span className="text-foreground font-bold">{(agent.limits.tokenBudget / 1000).toFixed(0)}k Tokens</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded bg-surfaceRaised border border-borderMuted">
              <span className="text-mutedForeground">Max Iteration Step Depth</span>
              <span className="text-foreground font-bold">{agent.limits.maxIterations} Iterations</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Historical Telemetry */}
      <div>
        <div className="text-xs font-bold uppercase text-mutedForeground tracking-wider mb-3">
          Historical Agent Telemetry
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-4 rounded-lg bg-surface border border-border">
            <div className="text-[10px] text-mutedForeground uppercase">Tasks Completed</div>
            <div className="text-lg font-bold text-foreground mt-1">{agent.metrics.completedTasks}</div>
          </div>
          <div className="p-4 rounded-lg bg-surface border border-border">
            <div className="text-[10px] text-mutedForeground uppercase">Failed Validations</div>
            <div className="text-lg font-bold text-danger mt-1">{agent.metrics.failedValidations}</div>
          </div>
          <div className="p-4 rounded-lg bg-surface border border-border">
            <div className="text-[10px] text-mutedForeground uppercase">Avg. Runtime</div>
            <div className="text-lg font-bold text-foreground mt-1">{(agent.metrics.averageRuntimeMs / 1000).toFixed(1)}s</div>
          </div>
          <div className="p-4 rounded-lg bg-surface border border-border">
            <div className="text-[10px] text-mutedForeground uppercase">Tokens Consumed</div>
            <div className="text-lg font-bold text-accent mt-1">{(agent.metrics.tokensConsumed / 1000).toFixed(1)}k</div>
          </div>
        </div>
      </div>
    </div>
  );
}
