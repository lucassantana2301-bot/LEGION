"use client";

import React from "react";
import { MissionHeader } from "@/components/missions/mission-header";
import { MissionProgressCard } from "@/components/missions/mission-progress-card";
import { AgentCardGrid } from "@/components/agents/agent-card-grid";
import { LegionAgentGraph } from "@/components/graph/legion-agent-graph";
import { LiveActivityFeed } from "@/components/activity/live-activity-feed";
import { LegionTerminal } from "@/components/terminal/legion-terminal";
import { FailureLoopBanner } from "@/components/tasks/failure-loop-banner";
import { LegionCommandInput } from "@/components/missions/legion-command-input";

export default function MissionControlPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background overflow-y-auto">
      {/* Top Header */}
      <MissionHeader />

      {/* Main Mission Workspace */}
      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Mission Summary & Metrics */}
        <MissionProgressCard />

        {/* 4 Legion Agents */}
        <AgentCardGrid />

        {/* Agent Graph & Failure Loop Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <LegionAgentGraph />
          <FailureLoopBanner />
        </div>

        {/* Live Activity & Terminal */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <LiveActivityFeed />
          <LegionTerminal />
        </div>

        {/* Direct Legion Command Input */}
        <LegionCommandInput />
      </div>
    </div>
  );
}
