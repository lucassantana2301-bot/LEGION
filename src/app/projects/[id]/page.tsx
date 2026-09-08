"use client";

import React from "react";
import Link from "next/link";
import { FolderGit2, FileCode, Play, Plus, Clock, ArrowRight, ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const recentFiles = [
    { path: "src/lib/auth.ts", status: "MODIFIED", agent: "BUILDER", updated: "3m ago", lines: 94 },
    { path: "src/app/api/auth/route.ts", status: "CREATED", agent: "BUILDER", updated: "8m ago", lines: 64 },
    { path: "src/lib/db/schema.ts", status: "CREATED", agent: "ARCHITECT", updated: "14m ago", lines: 142 },
    { path: "tests/auth.test.ts", status: "CREATED", agent: "SENTINEL", updated: "18m ago", lines: 110 },
  ];

  return (
    <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full font-mono">
      <div className="space-y-4">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-xs text-mutedForeground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Projects</span>
        </Link>

        {/* Project Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-5 h-5 text-accent" />
              <h1 className="text-xl font-bold font-sans text-foreground">
                FINANCEFLOW
              </h1>
              <Badge variant="success" size="sm">
                ACTIVE
              </Badge>
            </div>
            <p className="text-xs text-mutedForeground mt-1">
              Financial management SaaS with multi-tenant ledger, authentication, and PostgreSQL.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/projects/proj-001/files">
              <Button variant="secondary" size="md" icon={<FileCode className="w-4 h-4" />}>
                EXPLORE FILES
              </Button>
            </Link>
            <Link href="/missions/mission-001">
              <Button variant="primary" size="md" icon={<Play className="w-4 h-4" />}>
                OPEN ACTIVE MISSION
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs / Subsections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Missions in Project */}
        <Card variant="default" className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-mutedForeground tracking-wider">
              Project Missions (4)
            </span>
            <Link href="/" className="text-xs text-accent hover:underline">
              + New Mission
            </Link>
          </div>

          <div className="space-y-2">
            <Link href="/missions/mission-001" className="block">
              <div className="p-3 rounded bg-surfaceRaised hover:bg-surfaceOverlay border border-border flex items-center justify-between transition-colors">
                <div>
                  <div className="text-xs font-bold text-foreground">
                    MISSION #001: Financial SaaS MVP
                  </div>
                  <div className="text-[10px] text-mutedForeground mt-0.5">
                    12/19 Tasks · In Progress
                  </div>
                </div>
                <Badge variant="accent" size="sm">
                  RUNNING
                </Badge>
              </div>
            </Link>
          </div>
        </Card>

        {/* Recent Files Created / Modified by Agents */}
        <Card variant="default" className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-mutedForeground tracking-wider">
              Recent Agent File Activity
            </span>
            <Link href="/projects/proj-001/files" className="text-xs text-accent hover:underline">
              View all files
            </Link>
          </div>

          <div className="space-y-2 text-xs">
            {recentFiles.map((file, i) => (
              <div
                key={i}
                className="p-2.5 rounded bg-surfaceRaised border border-border flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-accent shrink-0" />
                  <span className="text-foreground truncate max-w-xs">{file.path}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" size="sm">
                    {file.agent}
                  </Badge>
                  <Badge variant={file.status === "MODIFIED" ? "warning" : "success"} size="sm">
                    {file.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
