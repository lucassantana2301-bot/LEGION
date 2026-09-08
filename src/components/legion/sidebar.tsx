"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  PlusCircle,
  FolderGit2,
  Bot,
  CheckSquare,
  AlertOctagon,
  BookOpen,
  Cpu,
  Settings,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  const navItems = [
    { label: "MISSION CONTROL", href: "/missions/mission-001", icon: LayoutDashboard },
    { label: "NEW MISSION", href: "/", icon: PlusCircle },
    { label: "PROJECTS", href: "/projects", icon: FolderGit2 },
    { label: "AGENTS", href: "/agents/commander", icon: Bot },
  ];

  const secondaryItems = [
    { label: "TASKS", href: "/missions/mission-001/tasks", icon: CheckSquare, badge: "12/19" },
    { label: "ISSUES", href: "/missions/mission-001/issues", icon: AlertOctagon, badge: "1 OPEN", badgeVariant: "warning" as const },
    { label: "KNOWLEDGE", href: "/knowledge", icon: BookOpen },
    { label: "INTEGRATIONS", href: "/integrations", icon: Cpu },
    { label: "SETTINGS", href: "/settings", icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-border bg-surface flex flex-col h-screen shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-border">
        <Link href="/" className="group block">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-accent flex items-center justify-center font-mono font-bold text-white text-sm shadow-glow">
              L
            </div>
            <div>
              <div className="text-sm font-bold tracking-widest font-mono text-foreground flex items-center gap-1.5">
                LEGION
                <span className="text-[10px] px-1 py-0.2 rounded bg-surfaceRaised text-mutedForeground border border-border">
                  v1.0
                </span>
              </div>
              <div className="text-[9px] font-mono tracking-wider text-mutedForeground uppercase">
                Autonomous Engineering
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-6">
        <div>
          <div className="px-2 mb-1.5 text-[10px] font-mono font-semibold tracking-wider text-mutedForeground uppercase">
            Platform
          </div>
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-2.5 px-3 py-2 rounded text-xs font-mono transition-colors group",
                    isActive
                      ? "bg-accent/15 text-accent border border-accent/25 font-semibold"
                      : "text-mutedForeground hover:text-foreground hover:bg-surfaceRaised"
                  )}
                >
                  <Icon className={clsx("w-4 h-4 shrink-0", isActive ? "text-accent" : "text-mutedForeground group-hover:text-foreground")} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div>
          <div className="px-2 mb-1.5 text-[10px] font-mono font-semibold tracking-wider text-mutedForeground uppercase">
            Operations
          </div>
          <nav className="space-y-0.5">
            {secondaryItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex items-center justify-between px-3 py-2 rounded text-xs font-mono transition-colors group",
                    isActive
                      ? "bg-accent/15 text-accent border border-accent/25 font-semibold"
                      : "text-mutedForeground hover:text-foreground hover:bg-surfaceRaised"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={clsx("w-4 h-4 shrink-0", isActive ? "text-accent" : "text-mutedForeground group-hover:text-foreground")} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <Badge variant={item.badgeVariant || "default"} size="sm">
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Security & Isolation indicator */}
      <div className="px-3 py-2.5 mx-3 mb-2 rounded bg-surfaceRaised border border-border flex items-center justify-between text-[11px] font-mono">
        <div className="flex items-center gap-1.5 text-mutedForeground">
          <ShieldCheck className="w-3.5 h-3.5 text-success" />
          <span>Sandbox Isolated</span>
        </div>
        <span className="text-[10px] text-mutedForeground font-semibold">DEMO</span>
      </div>

      {/* Footer / User Profile & Workspace */}
      <div className="p-3 border-t border-border bg-surfaceRaised/50 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full bg-border flex items-center justify-center text-[10px] font-mono font-bold text-foreground">
            AL
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium font-mono text-foreground truncate">Fintech Lab</div>
            <div className="text-[10px] text-mutedForeground truncate">alex@legion.ai</div>
          </div>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-mutedForeground" />
      </div>
    </aside>
  );
};
