"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  PlusCircle,
  FolderGit2,
  Bot,
  Play,
  Pause,
  AlertOctagon,
  CheckSquare,
  Settings,
  Terminal,
  X,
} from "lucide-react";
import { useMissionStore } from "@/stores/mission-store";

export const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const { pauseMission, resumeMission, mission, startMission } = useMissionStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const actions = [
    {
      id: "new-mission",
      title: "New Mission",
      category: "Navigation",
      icon: PlusCircle,
      perform: () => router.push("/"),
    },
    {
      id: "mission-control",
      title: "Open Mission Control (#001)",
      category: "Navigation",
      icon: Terminal,
      perform: () => router.push("/missions/mission-001"),
    },
    {
      id: "projects",
      title: "Open Projects Overview",
      category: "Navigation",
      icon: FolderGit2,
      perform: () => router.push("/projects"),
    },
    {
      id: "agents",
      title: "Inspect Legion Agents",
      category: "Navigation",
      icon: Bot,
      perform: () => router.push("/agents/commander"),
    },
    {
      id: "tasks",
      title: "Search & Inspect Tasks",
      category: "Operations",
      icon: CheckSquare,
      perform: () => router.push("/missions/mission-001/tasks"),
    },
    {
      id: "issues",
      title: "Open Quality Issues (Sentinel)",
      category: "Operations",
      icon: AlertOctagon,
      perform: () => router.push("/missions/mission-001/issues"),
    },
    {
      id: "pause-resume",
      title: mission.status === "RUNNING" ? "Pause Mission Execution" : "Resume Mission Execution",
      category: "Control",
      icon: mission.status === "RUNNING" ? Pause : Play,
      perform: () => (mission.status === "RUNNING" ? pauseMission() : resumeMission()),
    },
    {
      id: "run-demo",
      title: "Trigger Full Demo Simulation Cycle",
      category: "Simulation",
      icon: Play,
      perform: () => startMission(),
    },
    {
      id: "settings",
      title: "Platform Settings & API Keys",
      category: "Configuration",
      icon: Settings,
      perform: () => router.push("/settings"),
    },
  ];

  const filteredActions = actions.filter((a) =>
    a.title.toLowerCase().includes(query.toLowerCase()) ||
    a.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-lg bg-surfaceRaised border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-mutedForeground shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm font-mono text-foreground placeholder:text-mutedForeground focus:outline-none"
          />
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded text-mutedForeground hover:text-foreground hover:bg-surface"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-borderMuted">
          {filteredActions.length === 0 ? (
            <div className="p-6 text-center text-xs font-mono text-mutedForeground">
              No matching commands found.
            </div>
          ) : (
            <div className="space-y-1">
              {filteredActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => {
                      action.perform();
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded text-left text-xs font-mono hover:bg-surface transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 text-mutedForeground group-hover:text-accent shrink-0" />
                      <span className="text-foreground group-hover:text-white font-medium">
                        {action.title}
                      </span>
                    </div>
                    <span className="text-[10px] text-mutedForeground uppercase tracking-wider">
                      {action.category}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-surface/50 border-t border-border flex items-center justify-between text-[10px] font-mono text-mutedForeground">
          <div>Use ↑↓ to navigate</div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-surfaceRaised border border-border text-[9px]">ESC</kbd> to close
          </div>
        </div>
      </div>
    </div>
  );
};
