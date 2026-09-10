"use client";

import React from "react";
import Link from "next/link";
import { clsx } from "clsx";
import {
  FolderGit2,
  PlusCircle,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Filter,
  Layers,
} from "lucide-react";
import { useMissionHistoryStore, HistoricMission } from "@/stores/mission-history-store";
import { useMissionRuntimeStore } from "@/stores/mission-runtime-store";

export default function MissionsPage() {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const missions = useMissionHistoryStore((s) => s.missions);
  const runtimeStatus = useMissionRuntimeStore((s) => s.status);
  const runtimeMissionId = useMissionRuntimeStore((s) => s.missionId);

  const filteredMissions = missions.filter((m) => {
    if (statusFilter !== "ALL" && m.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        m.title.toLowerCase().includes(q) ||
        m.prompt.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getStatusBadge = (status: HistoricMission["status"]) => {
    switch (status) {
      case "COMPLETED":
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-success/15 text-success font-semibold border border-success/30">
            <CheckCircle2 className="w-3 h-3" /> COMPLETED
          </span>
        );
      case "FAILED":
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-danger/15 text-danger font-semibold border border-danger/30">
            <XCircle className="w-3 h-3" /> FAILED
          </span>
        );
      case "RUNNING":
      case "PLANNING":
      case "VALIDATING":
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-accent/20 text-accent font-semibold border border-accent/40 animate-pulse">
            <Clock className="w-3 h-3 animate-spin" /> {status}
          </span>
        );
      case "CANCELLED":
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-surfaceOverlay text-mutedForeground border border-border">
            {status}
          </span>
        );
    }
  };

  const getQaBadge = (qa: HistoricMission["qaResult"]) => {
    if (qa === "PASSED") {
      return (
        <span className="text-[10px] font-mono text-emerald-400 font-semibold flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" /> PASSED
        </span>
      );
    }
    if (qa === "FAILED") {
      return (
        <span className="text-[10px] font-mono text-danger font-semibold flex items-center gap-1">
          <ShieldAlert className="w-3.5 h-3.5" /> FAILED
        </span>
      );
    }
    return <span className="text-[10px] font-mono text-mutedForeground">—</span>;
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-7xl mx-auto w-full font-mono">
      {/* Page Title & New Mission CTA */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-accent" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Mission History & Autonomous Runs
            </h1>
          </div>
          <p className="text-xs text-mutedForeground mt-1">
            Complete audit trail of autonomous engineering missions, QA verifications, and sandbox executions.
          </p>
        </div>

        <Link
          href="/#new-mission"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)]"
        >
          <PlusCircle className="w-4 h-4" />
          <span>+ New Mission</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-surface border border-border text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-mutedForeground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search missions by title, ID, or prompt..."
            className="w-full pl-9 pr-3 py-1.5 rounded-md bg-background border border-border text-foreground placeholder:text-mutedForeground/60 focus:outline-none focus:border-accent text-xs"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center bg-surfaceRaised border border-border rounded-md p-0.5">
          {["ALL", "COMPLETED", "RUNNING", "FAILED", "CANCELLED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={clsx(
                "px-3 py-1 text-[11px] rounded transition-all",
                statusFilter === st
                  ? "bg-accent text-white font-bold"
                  : "text-mutedForeground hover:text-foreground"
              )}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Missions Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surfaceRaised border-b border-border text-mutedForeground text-[10px] uppercase font-semibold">
              <tr>
                <th className="p-3.5">Mission / Objective</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Created</th>
                <th className="p-3.5">Duration</th>
                <th className="p-3.5">Tasks</th>
                <th className="p-3.5">Integrated QA</th>
                <th className="p-3.5">Sandbox Provider</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredMissions.map((mission) => (
                <tr
                  key={mission.id}
                  className="hover:bg-surfaceRaised/60 transition-colors group"
                >
                  <td className="p-3.5 max-w-sm">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/missions/${mission.id}`}
                        className="font-bold text-foreground group-hover:text-accent transition-colors truncate block"
                      >
                        {mission.title}
                      </Link>
                    </div>
                    <span className="text-[10px] text-mutedForeground line-clamp-1 mt-0.5">
                      {mission.id} · {mission.prompt}
                    </span>
                  </td>

                  <td className="p-3.5 whitespace-nowrap">
                    {getStatusBadge(mission.status)}
                  </td>

                  <td className="p-3.5 whitespace-nowrap text-mutedForeground text-[11px]">
                    {new Date(mission.createdAt).toLocaleDateString()} {new Date(mission.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>

                  <td className="p-3.5 whitespace-nowrap text-foreground">
                    {Math.round(mission.durationMs / 1000)}s
                  </td>

                  <td className="p-3.5 whitespace-nowrap text-foreground font-semibold">
                    {mission.tasksCount}
                  </td>

                  <td className="p-3.5 whitespace-nowrap">
                    {getQaBadge(mission.qaResult)}
                  </td>

                  <td className="p-3.5 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded bg-surfaceRaised border border-border text-accent font-semibold text-[10px]">
                      {mission.provider}
                    </span>
                  </td>

                  <td className="p-3.5 whitespace-nowrap text-right">
                    <Link
                      href={`/missions/${mission.id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surfaceRaised hover:bg-surfaceOverlay border border-border text-accent hover:text-white transition-colors text-[11px] font-semibold"
                    >
                      <span>Control</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
