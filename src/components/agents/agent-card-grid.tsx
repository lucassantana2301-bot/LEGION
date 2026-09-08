"use client";

import React from "react";
import Link from "next/link";
import { Compass, Box, Hammer, ShieldAlert, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { Badge } from "@/components/ui/badge";
import { useAgentsSlice } from "@/stores/agents-slice";
import { AgentRole } from "@/types/domain";

export const AgentCardGrid: React.FC = () => {
  const agents = useAgentsSlice((s) => s.agents);

  const agentConfig: Record<
    AgentRole,
    {
      icon: React.ElementType;
      badgeText: string;
      colorClass: string;
      href: string;
    }
  > = {
    COMMANDER: {
      icon: Compass,
      badgeText: "ORCHESTRATOR",
      colorClass: "text-accent",
      href: "/agents/commander",
    },
    ARCHITECT: {
      icon: Box,
      badgeText: "SYSTEM DESIGN",
      colorClass: "text-info",
      href: "/agents/architect",
    },
    BUILDER: {
      icon: Hammer,
      badgeText: "IMPLEMENTATION",
      colorClass: "text-warning",
      href: "/agents/builder",
    },
    SENTINEL: {
      icon: ShieldAlert,
      badgeText: "QA & GATEKEEPER",
      colorClass: "text-success",
      href: "/agents/sentinel",
    },
  };

  const roleOrder: AgentRole[] = ["COMMANDER", "ARCHITECT", "BUILDER", "SENTINEL"];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-mono font-bold tracking-wider text-mutedForeground uppercase flex items-center gap-2">
          <span>LEGION AGENTS</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surfaceRaised text-mutedForeground border border-border">
            4 ACTIVE
          </span>
        </h3>
        <span className="text-[10px] font-mono text-mutedForeground">
          Click card to inspect role telemetry
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {roleOrder.map((role) => {
          const agent = agents[role];
          const cfg = agentConfig[role];
          const Icon = cfg.icon;

          return (
            <Link key={role} href={cfg.href}>
              <Card
                variant="interactive"
                className="p-4 h-full flex flex-col justify-between group transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded bg-surfaceRaised border border-border group-hover:border-borderMuted">
                        <Icon className={`w-4 h-4 ${cfg.colorClass}`} />
                      </div>
                      <div>
                        <div className="text-xs font-mono font-bold text-foreground group-hover:text-white">
                          {agent.name}
                        </div>
                        <div className="text-[9px] font-mono text-mutedForeground">
                          {cfg.badgeText}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <StatusDot status={agent.status} pulse={agent.status === "WORKING"} />
                      <span className="text-[10px] font-mono font-semibold text-foreground uppercase">
                        {agent.status}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs font-mono text-mutedForeground mt-2 line-clamp-2 min-h-[32px]">
                    {agent.currentTaskTitle || agent.tagline}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-borderMuted flex items-center justify-between text-[10px] font-mono text-mutedForeground">
                  <span className="truncate">
                    {agent.metrics.completedTasks} tasks · {agent.metrics.issuesDiscovered} issues
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-mutedForeground group-hover:text-foreground shrink-0" />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
