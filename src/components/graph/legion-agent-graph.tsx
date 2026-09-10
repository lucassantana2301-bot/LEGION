"use client";

import React, { useState, useEffect } from "react";
import { useAgentsSlice } from "@/stores/agents-slice";
import { useActivitySlice } from "@/stores/activity-slice";
import { useMissionRuntimeStore } from "@/stores/mission-runtime-store";
import { AgentRole } from "@/types/domain";
import { Compass, Box, Hammer, ShieldAlert, Cpu, CheckCircle2 } from "lucide-react";

export const LegionAgentGraph: React.FC = () => {
  const agents = useAgentsSlice((s) => s.agents);
  const activeCommunication = useActivitySlice((s) => s.activeCommunication);
  const { status, activeAgent, tasks } = useMissionRuntimeStore();

  const isRevisionActive = tasks.some((t) => t.status === "REVISION_REQUIRED");

  const nodes: Record<
    AgentRole,
    { x: number; y: number; label: string; icon: React.ElementType; color: string; hex: string }
  > = {
    COMMANDER: {
      x: 300,
      y: 45,
      label: "COMMANDER",
      icon: Compass,
      color: "var(--role-commander)",
      hex: "#818cf8",
    },
    ARCHITECT: {
      x: 100,
      y: 175,
      label: "ARCHITECT",
      icon: Box,
      color: "var(--role-architect)",
      hex: "#38bdf8",
    },
    BUILDER: {
      x: 300,
      y: 175,
      label: "BUILDER",
      icon: Hammer,
      color: "var(--role-builder)",
      hex: "#fbbf24",
    },
    SENTINEL: {
      x: 500,
      y: 175,
      label: "SENTINEL",
      icon: ShieldAlert,
      color: "var(--role-sentinel)",
      hex: "#34d399",
    },
  };

  const edges = [
    { from: "COMMANDER", to: "ARCHITECT", path: "M 300 65 L 100 155", id: "c-a" },
    { from: "COMMANDER", to: "BUILDER", path: "M 300 65 L 300 155", id: "c-b" },
    { from: "COMMANDER", to: "SENTINEL", path: "M 300 65 L 500 155", id: "c-s" },
    { from: "ARCHITECT", to: "BUILDER", path: "M 125 175 L 275 175", id: "a-b" },
    { from: "BUILDER", to: "SENTINEL", path: "M 325 170 L 475 170", id: "b-s" },
    { from: "SENTINEL", to: "BUILDER", path: "M 475 185 L 325 185", id: "s-b" },
  ];

  return (
    <div className="bg-surface rounded-lg border border-border p-4 flex flex-col justify-between">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-mono font-semibold tracking-wider text-mutedForeground uppercase flex items-center gap-2">
          <span>AGENT TOPOLOGY & EXECUTION GRAPH</span>
          <span className="text-[10px] text-accent font-normal">● LIVE BUS</span>
        </span>
        <div className="flex items-center gap-2 text-[10px] font-mono">
          {isRevisionActive && (
            <span className="px-2 py-0.5 rounded bg-warning/15 border border-warning/40 text-warning font-bold animate-pulse">
              REVISION LOOP ACTIVE (SENTINEL → BUILDER)
            </span>
          )}
        </div>
      </div>

      {/* SVG Canvas for topology */}
      <div className="relative w-full h-[240px] flex items-center justify-center bg-background/60 rounded border border-borderMuted overflow-hidden">
        <svg
          viewBox="0 0 600 240"
          className="w-full h-full select-none"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Base Wireframe Edges */}
          {edges.map((edge) => {
            const isFeedbackEdge = edge.id === "s-b";
            const isForwardFlow = edge.id === "b-s";
            const isCommanderFlow = edge.id === "c-b" || edge.id === "c-s";

            const isFlowing =
              (isFeedbackEdge && isRevisionActive) ||
              (isForwardFlow && (status === "EXECUTING" || status === "VERIFYING")) ||
              (isCommanderFlow && status === "PLANNING");

            return (
              <g key={edge.id}>
                <path
                  d={edge.path}
                  stroke={isFeedbackEdge && isRevisionActive ? "rgba(245, 158, 11, 0.4)" : "#1e2638"}
                  strokeWidth={isFeedbackEdge && isRevisionActive ? "2.5" : "2"}
                  strokeDasharray={isFeedbackEdge ? "3 3" : "4 4"}
                  fill="none"
                />
                {isFlowing && (
                  <path
                    d={edge.path}
                    stroke={isFeedbackEdge ? "#f59e0b" : "#3b82f6"}
                    strokeWidth="2.5"
                    strokeDasharray="6 6"
                    fill="none"
                    className="animate-flow-line"
                  />
                )}
              </g>
            );
          })}

          {/* Agent Nodes */}
          {(Object.keys(nodes) as AgentRole[]).map((role) => {
            const node = nodes[role];
            const agent = agents[role];
            const isCurrentActive = activeAgent === role;
            const isWorking = agent.status === "WORKING" || isCurrentActive;

            return (
              <g key={role} transform={`translate(${node.x}, ${node.y})`}>
                {/* Outer Ping Halo */}
                {isWorking && (
                  <circle
                    r="24"
                    fill="none"
                    stroke={node.hex}
                    strokeWidth="1.5"
                    opacity="0.3"
                    className="animate-ping"
                  />
                )}

                {/* Node Background */}
                <circle
                  r="20"
                  fill="#0e1117"
                  stroke={isWorking ? node.hex : "#1f2738"}
                  strokeWidth={isWorking ? "2" : "1"}
                  className="transition-colors"
                />

                {/* Node Label */}
                <text
                  y="34"
                  textAnchor="middle"
                  fill="#f8fafc"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="600"
                >
                  {node.label}
                </text>
                <text
                  y="46"
                  textAnchor="middle"
                  fill={isWorking ? node.hex : "#94a3b8"}
                  fontSize="8"
                  fontFamily="monospace"
                  fontWeight={isWorking ? "700" : "400"}
                >
                  {isWorking ? "ACTIVE" : agent.status}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Real-time event communication badge */}
        {activeCommunication && (
          <div className="absolute bottom-2 left-3 right-3 bg-surfaceRaised/95 backdrop-blur border border-accent/40 rounded px-3 py-1.5 flex items-center justify-between text-[11px] font-mono animate-in fade-in duration-200">
            <span className="text-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span>
                <strong className="text-accent">{activeCommunication.from}</strong> →{" "}
                <strong className="text-foreground">{activeCommunication.to}</strong>
              </span>
            </span>
            <span className="text-[10px] text-mutedForeground uppercase font-semibold">EVENT BUS BROADCAST</span>
          </div>
        )}
      </div>
    </div>
  );
};
