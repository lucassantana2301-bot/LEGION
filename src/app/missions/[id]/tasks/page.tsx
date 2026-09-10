"use client";

import React from "react";
import { CheckSquare, Filter, Layers, Clock, AlertTriangle, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status-dot";
import { useTasksSlice } from "@/stores/tasks-slice";

export const dynamic = "force-dynamic";

export default function TasksPage() {
  const tasks = useTasksSlice((s) => s.tasks);
  const selectTask = useTasksSlice((s) => s.selectTask);

  const completedCount = tasks.filter((t) => t.status === "COMPLETED").length;
  const inProgressCount = tasks.filter((t) => t.status === "IN_PROGRESS").length;

  return (
    <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full font-mono select-none">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="text-xs font-bold text-mutedForeground uppercase flex items-center gap-2">
            <span>LEGION</span>
            <span>/</span>
            <span className="text-foreground">TASK GRAPH & EXECUTION</span>
          </div>
          <h1 className="text-xl font-bold font-sans text-foreground mt-1">
            Tasks System
          </h1>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline" size="md">
            TOTAL: {tasks.length}
          </Badge>
          <Badge variant="success" size="md">
            COMPLETED: {completedCount}
          </Badge>
          <Badge variant="accent" size="md">
            IN PROGRESS: {inProgressCount}
          </Badge>
        </div>
      </div>

      {/* Tasks Content */}
      {tasks.length === 0 ? (
        <div className="p-12 rounded-lg bg-surface/50 border border-border border-dashed text-center font-mono text-xs text-mutedForeground space-y-2">
          <ShieldCheck className="w-8 h-8 text-mutedForeground/40 mx-auto" />
          <div className="font-semibold text-foreground">NO TASKS DISPATCHED // STANDBY</div>
          <div className="text-[11px] text-mutedForeground/70 max-w-md mx-auto">
            Tasks formulated by Commander and dispatched to Builder & Sentinel will appear here during mission execution.
          </div>
        </div>
      ) : (
        <div className="bg-surface rounded-lg border border-border overflow-hidden shadow-subtle">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surfaceRaised border-b border-border text-[10px] text-mutedForeground uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Task ID & Title</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Dependencies</th>
                  <th className="py-3 px-4">Attempts</th>
                  <th className="py-3 px-4">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderMuted">
                {tasks.map((task) => (
                  <tr
                    key={task.id}
                    onClick={() => selectTask(task.id)}
                    className="hover:bg-surfaceRaised/80 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <span className="text-accent font-bold">{task.id}</span>
                        <span className="group-hover:text-white transition-colors truncate max-w-sm">
                          {task.title}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge variant="outline" size="sm">
                        {task.assignedRole}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <StatusDot status={task.status} pulse={task.status === "IN_PROGRESS"} />
                        <span className="text-[11px] font-semibold text-foreground uppercase">
                          {task.status}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge
                        variant={
                          task.priority === "HIGH" || task.priority === "CRITICAL"
                            ? "danger"
                            : task.priority === "MEDIUM"
                            ? "warning"
                            : "default"
                        }
                        size="sm"
                      >
                        {task.priority}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4 text-mutedForeground text-[11px]">
                      {task.dependencies.length > 0 ? task.dependencies.join(", ") : "—"}
                    </td>

                    <td className="py-3.5 px-4 text-mutedForeground">
                      <span className="text-foreground">{task.attempts}</span> / {task.maxAttempts}
                    </td>

                    <td className="py-3.5 px-4 text-mutedForeground text-[10px]">
                      {task.updatedAt.includes("T") ? task.updatedAt.slice(11, 19) : "Just now"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
