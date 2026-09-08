"use client";

import React from "react";
import Link from "next/link";
import { FolderGit2, Plus, ArrowRight, Layers, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function ProjectsPage() {
  const projects = [
    {
      id: "proj-001",
      name: "FINANCEFLOW",
      description: "Financial management SaaS with multi-tenant ledger, authentication, and PostgreSQL.",
      framework: "Next.js (App Router)",
      database: "PostgreSQL + Drizzle ORM",
      missionCount: 4,
      lastExecution: "2h ago",
      status: "ACTIVE",
    },
    {
      id: "proj-002",
      name: "AUTH-GUARDIAN",
      description: "Autonomous SSO and session token verification service with rate limiting.",
      framework: "Node.js / Express",
      database: "Redis",
      missionCount: 2,
      lastExecution: "1d ago",
      status: "ACTIVE",
    },
  ];

  return (
    <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full font-mono">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="text-xs font-bold text-mutedForeground uppercase">
            WORKSPACE // FINTECH LAB
          </div>
          <h1 className="text-xl font-bold font-sans text-foreground mt-1">
            Projects Overview
          </h1>
        </div>

        <Button variant="primary" size="md" icon={<Plus className="w-4 h-4" />}>
          NEW PROJECT
        </Button>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((proj) => (
          <Link key={proj.id} href={`/projects/${proj.id}`}>
            <Card variant="interactive" className="p-5 h-full flex flex-col justify-between group">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <FolderGit2 className="w-5 h-5 text-accent" />
                    <h2 className="text-base font-bold text-foreground font-sans group-hover:text-white">
                      {proj.name}
                    </h2>
                  </div>
                  <Badge variant="success" size="sm">
                    {proj.status}
                  </Badge>
                </div>

                <p className="text-xs text-mutedForeground line-clamp-2 mt-1">
                  {proj.description}
                </p>

                <div className="flex flex-wrap gap-2 mt-4">
                  <Badge variant="outline" size="sm">
                    {proj.framework}
                  </Badge>
                  <Badge variant="outline" size="sm">
                    {proj.database}
                  </Badge>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-borderMuted flex items-center justify-between text-xs text-mutedForeground">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" /> {proj.missionCount} missions
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {proj.lastExecution}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-mutedForeground group-hover:text-foreground" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
