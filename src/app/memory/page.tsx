"use client";

import React from "react";
import {
  Database,
  Search,
  BookOpen,
  FileCode2,
  Lightbulb,
  CheckCircle2,
  Tag,
  Clock,
  Filter,
} from "lucide-react";
import { useMissionHistoryStore } from "@/stores/mission-history-store";
import { MissionMemoryPanel } from "@/components/missions/mission-memory-panel";

export default function MemoryPage() {
  const [search, setSearch] = React.useState("");

  const memories = [
    {
      id: "mem-01",
      mission: "mission-001",
      role: "ARCHITECT",
      type: "INTERFACE_CONTRACT",
      title: "Fibonacci Utility Type Contract",
      content: "Defines calculateFibonacci(n: number): number with strict negative index rejection and BigInt compatibility.",
      tags: ["interface", "types", "math"],
      importance: "CRITICAL",
      createdAt: "2 hours ago",
    },
    {
      id: "mem-02",
      mission: "mission-001",
      role: "SENTINEL",
      type: "SENTINEL_FINDING",
      title: "100% Test Coverage & Zero Compile Diagnostics",
      content: "All 5 assertions passed in sandbox node test runner with 0 diagnostic compiler warnings.",
      tags: ["qa", "coverage", "pass"],
      importance: "HIGH",
      createdAt: "2 hours ago",
    },
    {
      id: "mem-03",
      mission: "mission-002",
      role: "ARCHITECT",
      type: "ARCHITECTURE_DECISION",
      title: "JWT Key Rotation & Storage Boundary",
      content: "Adopted RS256 asymmetric signatures with key rotation cache and HTTP-only cookie tokens.",
      tags: ["security", "auth", "jwt"],
      importance: "CRITICAL",
      createdAt: "6 hours ago",
    },
    {
      id: "mem-04",
      mission: "mission-003",
      role: "COMMANDER",
      type: "COMMANDER_DECISION",
      title: "DAG Concurrency Limit Tuning",
      content: "Optimized parallel worker allocation to 2 concurrent slots to avoid sandbox file lock contention.",
      tags: ["concurrency", "dag", "optimization"],
      importance: "HIGH",
      createdAt: "18 hours ago",
    },
  ];

  const filteredMemories = memories.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) ||
      m.content.toLowerCase().includes(q) ||
      m.tags.some((t) => t.includes(q))
    );
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-7xl mx-auto w-full font-mono text-xs">
      {/* Header */}
      <div className="pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-accent" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Mission Memory & Architectural Knowledge
          </h1>
        </div>
        <p className="text-mutedForeground mt-1 text-[11px]">
          Persistent shared context across autonomous missions, architecture interface contracts, and Sentinel quality lessons.
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-mutedForeground absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search memory entries by title, content, or tag..."
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface border border-border text-foreground placeholder:text-mutedForeground/60 focus:outline-none focus:border-accent text-xs"
        />
      </div>

      {/* Memory Entries List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredMemories.map((mem) => (
          <div
            key={mem.id}
            className="p-4 rounded-xl bg-surface border border-border space-y-3 hover:bg-surfaceRaised/50 transition-all shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-accent/15 text-accent border border-accent/30">
                    {mem.role}
                  </span>
                  <span className="text-[10px] text-mutedForeground">
                    {mem.mission}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-foreground">{mem.title}</h3>
              </div>

              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-surfaceRaised border border-border text-mutedForeground">
                {mem.importance}
              </span>
            </div>

            <p className="text-foreground/90 text-xs leading-relaxed bg-surfaceRaised/70 p-2.5 rounded-lg border border-border/70">
              {mem.content}
            </p>

            <div className="flex items-center justify-between pt-1 text-[10px] text-mutedForeground">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Tag className="w-3 h-3 text-mutedForeground" />
                {mem.tags.map((t) => (
                  <span key={t} className="px-1.5 py-0.2 rounded bg-surfaceOverlay text-mutedForeground border border-border">
                    #{t}
                  </span>
                ))}
              </div>
              <span>{mem.createdAt}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
