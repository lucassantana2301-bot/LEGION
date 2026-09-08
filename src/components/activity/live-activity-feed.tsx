"use client";

import React from "react";
import { useActivitySlice } from "@/stores/activity-slice";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";
import { AgentRole } from "@/types/domain";

export const LiveActivityFeed: React.FC = () => {
  const activities = useActivitySlice((s) => s.activities);

  const getRoleBadgeVariant = (role?: AgentRole) => {
    switch (role) {
      case "COMMANDER":
        return "accent";
      case "ARCHITECT":
        return "info";
      case "BUILDER":
        return "warning";
      case "SENTINEL":
        return "success";
      default:
        return "default";
    }
  };

  const getSeverityIcon = (sev?: string) => {
    switch (sev) {
      case "ERROR":
        return <XCircle className="w-3.5 h-3.5 text-danger shrink-0 mt-0.5" />;
      case "WARNING":
        return <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />;
      case "SUCCESS":
        return <CheckCircle className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />;
      default:
        return <Info className="w-3.5 h-3.5 text-mutedForeground shrink-0 mt-0.5" />;
    }
  };

  return (
    <div className="bg-surface rounded-lg border border-border p-4 flex flex-col h-[380px]">
      <div className="flex items-center justify-between pb-3 border-b border-borderMuted mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent" />
          <h3 className="text-xs font-mono font-bold tracking-wider text-mutedForeground uppercase">
            LIVE ACTIVITY STREAM
          </h3>
        </div>
        <span className="text-[10px] font-mono text-mutedForeground">
          {activities.length} EVENTS LOGGED
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {activities.map((act) => {
          const isError = act.severity === "ERROR";
          const isSuccess = act.severity === "SUCCESS";

          return (
            <div
              key={act.id}
              className={`p-2.5 rounded border text-xs font-mono transition-colors ${
                isError
                  ? "bg-danger/10 border-danger/30 text-danger-foreground"
                  : isSuccess
                  ? "bg-success/5 border-success/20 text-foreground"
                  : "bg-surfaceRaised border-borderMuted text-foreground"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-mutedForeground">
                    {act.timestamp.includes("T") ? act.timestamp.slice(11, 19) : act.timestamp}
                  </span>
                  {act.agentRole && (
                    <Badge variant={getRoleBadgeVariant(act.agentRole)} size="sm">
                      {act.agentRole}
                    </Badge>
                  )}
                </div>

                <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                  {act.title}
                </span>
              </div>

              <div className="flex items-start gap-2 mt-1">
                {getSeverityIcon(act.severity)}
                <p className="text-xs leading-relaxed text-foreground font-mono">
                  {act.message}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
