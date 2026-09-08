import React from "react";
import { AgentStatus, MissionStatus, TaskStatus } from "@/types/domain";

interface StatusDotProps {
  status: AgentStatus | MissionStatus | TaskStatus | "OPEN" | "RESOLVED" | "FIXING" | "RETESTING";
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
}

export const StatusDot: React.FC<StatusDotProps> = ({
  status,
  size = "md",
  pulse = false,
}) => {
  let colorClass = "bg-muted-foreground";

  switch (status) {
    case "WORKING":
    case "RUNNING":
    case "IN_PROGRESS":
      colorClass = "bg-accent";
      break;
    case "COMPLETED":
    case "RESOLVED":
    case "READY":
      colorClass = "bg-success";
      break;
    case "WAITING":
    case "THINKING":
    case "PLANNING":
    case "REVIEW":
    case "FIXING":
    case "RETESTING":
      colorClass = "bg-warning";
      break;
    case "ERROR":
    case "FAILED":
    case "OPEN":
    case "BLOCKED":
      colorClass = "bg-danger";
      break;
    case "IDLE":
    case "BACKLOG":
    case "DRAFT":
    case "OFFLINE":
    case "PAUSED":
    case "CANCELLED":
    default:
      colorClass = "bg-muted-foreground";
      break;
  }

  const sizeClass = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-2.5 h-2.5",
  }[size];

  return (
    <span className="relative flex items-center justify-center">
      {(pulse || status === "WORKING" || status === "RUNNING") && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${colorClass}`}
        />
      )}
      <span className={`relative inline-flex rounded-full ${sizeClass} ${colorClass}`} />
    </span>
  );
};
