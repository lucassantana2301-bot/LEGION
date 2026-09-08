"use client";

import React, { useState, useEffect } from "react";
import { useMissionStore } from "@/stores/mission-store";
import { AgentRole } from "@/types/domain";
import { Compass, Box, Hammer, ShieldAlert } from "lucide-react";

export const LegionAgentGraph: React.FC = () => {
  const { agents, activeCommunication } = useMissionStore();
  const [pulseLine, setPulseLine] = useState<string | null>(null);

  useEffect(() => {
    if (activeCommunication) {
      const key = `${activeCommunication.from}->${activeCommunication.to}`;
      setPulseLine(key);
      const timer = setTimeout(() => setPulseLine(null), 2400);
      return () => clearTimeout(timer);
    }
  }, [activeCommunication]);

  const nodes: Record<
    AgentRole,
    { x: number; y: number; label: string; icon: React.ElementType; color: string; bgClass: string }
  > = {
    COMMANDER: {
      x: 300,
      y: 48,
      label: "COMMANDER",
      icon: Compass,
      color: "#3b82f6",
      bgClass: "border-accent",
    },
    ARCHITECT: {
      x: 100,
      y: 190,
      label: "ARCHITECT",
      icon: Box,
      color: "#06b6d4",
      bgClass: "border-info",
    },
    BUILDER: {
      x: 300,
      y: 190,
      label: "BUILDER",
      icon: Hammer,
      color: "#f59e0b",
      bgClass: "border-warning",
    },
    SENTINEL: {
      x: 500,
      y: 190,
      label: "SENTINEL",
      icon: ShieldAlert,
      color: "#10b981",
      bgClass: "border-success",
    },
  };

  const edges = [
    { from: "COMMANDER", to: "ARCHITECT", path: "M 300 70 L 100 170" },
    { from: "COMMANDER", to: "BUILDER", path: "M 300 70 L 300 170" },
    { from: "COMMANDER", to: "SENTINEL", path: "M 300 70 L 500 170" },
    { from: "ARCHITECT", to: "BUILDER", path: "M 130 190 L 270 190" },
    { from: "BUILDER", to: "SENTINEL", path: "M 330 190 L 470 190" },
    { from: "SENTINEL", to: "BUILDER", path: "M 470 198 L 330 198" },
  ];

  return (
    <div className="bg-surface rounded-lg border border-border p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-mono font-semibold tracking-wider text-mutedForeground uppercase flex items-center gap-2">
          <span>AGENT TOPOLOGY & COMMUNICATION</span>
          <span className="text-[10px] text-accent font-normal">● LIVE BUS</span>
        </span>
        <div className="flex items-center gap-3 text-[10px] font-mono text-mutedForeground">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> Active Channel
          </span>
        </div>
      </div>

      {/* SVG Canvas for topology */}
      <div className="relative w-full h-[240px] flex items-center justify-center bg-background/50 rounded border border-borderMuted overflow-hidden">
        <svg
          viewBox="0 0 600 240"
          className="w-full h-full select-none"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="grad-pulse" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
            </linearGradient>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="4"
              markerHeight="4"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#242b3b" />
            </marker>
          </defs>

          {/* Base Wireframe Edges */}
          {edges.map((edge, idx) => {
            const isFlowing =
              pulseLine === `${edge.from}->${edge.to}` ||
              (pulseLine === null && idx === 4); // subtle default pulse

            return (
              <g key={idx}>
                <path
                  d={edge.path}
                  stroke="#1e2638"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  fill="none"
                />
                {isFlowing && (
                  <path
                    d={edge.path}
                    stroke="#3b82f6"
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
            const isWorking = agent.status === "WORKING";
            const isIdle = agent.status === "IDLE";
            const Icon = node.icon;

            return (
              <g key={role} transform={`translate(${node.x}, ${node.y})`}>
                {/* Node Outer Halo for active state */}
                {isWorking && (
                  <circle
                    r="24"
                    fill="none"
                    stroke={node.color}
                    strokeWidth="1.5"
                    opacity="0.3"
                    className="animate-ping"
                  />
                )}
                {/* Node Background */}
                <circle
                  r="20"
                  fill="#0e1117"
                  stroke={isWorking ? node.color : "#242b3b"}
                  strokeWidth={isWorking ? "2" : "1"}
                  className="transition-colors"
                />

                {/* Node Label */}
                <text
                  y="34"
                  textAnchor="middle"
                  fill="#f1f5f9"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="600"
                >
                  {node.label}
                </text>
                <text
                  y="46"
                  textAnchor="middle"
                  fill={isWorking ? node.color : "#8a99ad"}
                  fontSize="8"
                  fontFamily="monospace"
                >
                  {agent.status}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Real-time event toast bar */}
        {activeCommunication && (
          <div className="absolute bottom-2 left-3 right-3 bg-surfaceRaised/90 backdrop-blur border border-accent/40 rounded px-3 py-1.5 flex items-center justify-between text-[11px] font-mono animate-in fade-in duration-200">
            <span className="text-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span>
                <strong className="text-accent">{activeCommunication.from}</strong> →{" "}
                <strong className="text-foreground">{activeCommunication.to}</strong>
              </span>
            </span>
            <span className="text-[10px] text-mutedForeground">BUS BROADCAST</span>
          </div>
        )}
      </div>
    </div>
  );
};
