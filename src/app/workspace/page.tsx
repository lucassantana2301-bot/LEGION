"use client";

import React from "react";
import {
  Layers,
  FolderGit2,
  FileCode,
  ShieldCheck,
  Hash,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";
import { CanonicalWorkspaceViewer } from "@/components/missions/canonical-workspace-viewer";

export default function WorkspacePage() {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-7xl mx-auto w-full font-mono">
      {/* Header */}
      <div className="pb-3 border-b border-border flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-accent" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Canonical Workspace Explorer
            </h1>
          </div>
          <p className="text-xs text-mutedForeground mt-1">
            Deterministic in-memory project filesystem with SHA-256 cryptographic digest reconciliation.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded bg-surfaceRaised border border-border text-foreground font-semibold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-success" />
            <span>Zero-Bypass Locked</span>
          </span>
        </div>
      </div>

      {/* Main Workspace Explorer */}
      <CanonicalWorkspaceViewer />

      {/* Reconciled Information Callout */}
      <div className="p-4 rounded-xl bg-surface border border-border grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="space-y-1">
          <span className="text-[10px] text-mutedForeground uppercase font-semibold">
            Reconciliation Policy
          </span>
          <p className="text-foreground text-[11px] leading-relaxed">
            All files are written atomically into isolated micro-VM sandboxes. Extraneous files are purged before Integrated QA.
          </p>
        </div>

        <div className="space-y-1">
          <span className="text-[10px] text-mutedForeground uppercase font-semibold">
            Cryptographic Integrity
          </span>
          <p className="text-foreground text-[11px] leading-relaxed">
            Remote readback digests are computed over all active files. Zero discrepancy permitted between canonical & remote state.
          </p>
        </div>

        <div className="space-y-1">
          <span className="text-[10px] text-mutedForeground uppercase font-semibold">
            Generation Boundary
          </span>
          <p className="text-foreground text-[11px] leading-relaxed">
            Task patches are cryptographically bound to mission generation IDs. Stale or cross-mission patches are rejected fail-closed.
          </p>
        </div>
      </div>
    </div>
  );
}
