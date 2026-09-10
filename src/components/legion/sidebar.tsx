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
  Layers,
  Database,
  Settings,
  ShieldCheck,
  Cpu,
  Radio,
} from "lucide-react";
import { useMissionRuntimeStore } from "@/stores/mission-runtime-store";
import { useMissionHistoryStore } from "@/stores/mission-history-store";

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const [mounted, setMounted] = React.useState(false);
  const runtimeStatus = useMissionRuntimeStore((s) => s.status);
  const activeMissionId = useMissionRuntimeStore((s) => s.missionId);
  const missions = useMissionHistoryStore((s) => s.missions);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const activeMissionsCount = mounted
    ? missions.filter((m) => m.status === "RUNNING" || m.status === "PLANNING" || m.status === "VALIDATING").length +
      (runtimeStatus === "EXECUTING" || runtimeStatus === "PLANNING" || runtimeStatus === "VERIFYING" ? 1 : 0)
    : 0;

  const isLiveRunning =
    runtimeStatus === "EXECUTING" ||
    runtimeStatus === "PLANNING" ||
    runtimeStatus === "VERIFYING";

  const primaryNavItems = [
    { label: "Overview", href: "/", icon: LayoutDashboard },
    {
      label: "Missions",
      href: "/missions",
      icon: FolderGit2,
      badge: mounted && missions.length > 0 ? `${missions.length}` : undefined,
    },
    { label: "Agents", href: "/agents", icon: Bot },
    { label: "Workspace", href: "/workspace", icon: Layers },
    { label: "Memory", href: "/memory", icon: Database },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-border bg-surface flex flex-col h-screen shrink-0 select-none z-30">
      {/* Brand Header */}
      <div className="p-4 border-b border-border notranslate" translate="no" suppressHydrationWarning>
        <Link href="/" className="group flex items-center gap-2.5 notranslate" translate="no" suppressHydrationWarning>
          <div className="w-8 h-8 rounded-md bg-accent flex items-center justify-center font-mono font-bold text-white text-sm shadow-[0_0_15px_rgba(59,130,246,0.35)] shrink-0 group-hover:scale-105 transition-transform">
            L
          </div>
          <div className="flex flex-col min-w-0 notranslate" translate="no" suppressHydrationWarning>
            <div className="flex items-center gap-2 notranslate" translate="no" suppressHydrationWarning>
              <span className="text-sm font-bold tracking-widest font-mono text-foreground notranslate" translate="no" suppressHydrationWarning>
                LEGION
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-surfaceRaised text-accent font-mono border border-border notranslate" translate="no" suppressHydrationWarning>
                CORE v0.1
              </span>
            </div>
            <span className="text-[9px] font-mono tracking-wider text-mutedForeground uppercase notranslate" translate="no" suppressHydrationWarning>
              Autonomous Engineering
            </span>
          </div>
        </Link>
      </div>

      {/* Live Mission Indicator (if active) */}
      {mounted && isLiveRunning && (
        <div className="px-3 pt-3 pb-1">
          <Link
            href={`/missions/${activeMissionId || "live"}`}
            className="flex items-center justify-between px-3 py-2 rounded bg-accent/10 border border-accent/30 text-accent text-xs font-mono group hover:bg-accent/15 transition-all"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
              </span>
              <span className="font-semibold truncate">LIVE MISSION</span>
            </div>
            <span className="text-[10px] text-accent/80 font-mono">Control &rarr;</span>
          </Link>
        </div>
      )}

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          <div className="px-2 mb-2 text-[10px] font-mono font-semibold tracking-wider text-mutedForeground uppercase">
            Platform
          </div>
          <nav className="space-y-1">
            {primaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex items-center justify-between px-3 py-2 rounded-md text-xs font-mono transition-all group",
                    isActive
                      ? "bg-surfaceRaised text-foreground border border-border shadow-sm font-semibold"
                      : "text-mutedForeground hover:text-foreground hover:bg-surfaceRaised/50"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={clsx(
                        "w-4 h-4 shrink-0 transition-colors",
                        isActive ? "text-accent" : "text-mutedForeground group-hover:text-foreground"
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surfaceOverlay text-mutedForeground border border-border">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Quick Actions */}
        <div>
          <div className="px-2 mb-2 text-[10px] font-mono font-semibold tracking-wider text-mutedForeground uppercase">
            Quick Actions
          </div>
          <div className="space-y-1">
            <Link
              href="/#new-mission"
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-mono text-accent bg-accent/5 hover:bg-accent/10 border border-accent/20 transition-all"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>+ New Mission</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom System & Provider Status Deck */}
      <div className="p-3 border-t border-border bg-surfaceRaised/50 space-y-2.5 text-xs font-mono">
        {/* System Status */}
        <div className="flex items-center justify-between px-2 py-1.5 rounded bg-surface border border-border text-[11px]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success inline-block shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-foreground font-medium">System</span>
          </div>
          <span className="text-success text-[10px] font-semibold">OPERATIONAL</span>
        </div>

        {/* Provider Status */}
        <div className="px-2 py-1.5 rounded bg-surface border border-border space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 text-mutedForeground">
              <Cpu className="w-3.5 h-3.5 text-accent" />
              <span>Sandbox</span>
            </div>
            <span className="text-[10px] font-semibold text-accent">E2B · READY</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-mutedForeground pt-0.5">
            <span>LLM Engine</span>
            <span className="text-foreground font-mono">Gemini 1.5 Pro</span>
          </div>
        </div>

        {/* Version Footer */}
        <div className="flex items-center justify-between px-1 text-[10px] text-mutedForeground/80">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-success" />
            <span>Zero-Bypass Gate</span>
          </div>
          <span>v0.1.0</span>
        </div>
      </div>
    </aside>
  );
};
