"use client";

import React from "react";
import { BookOpen, Search, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function KnowledgePage() {
  const documents = [
    {
      title: "Fintech Architecture & Security Guidelines",
      category: "Architecture",
      lastUpdated: "Yesterday",
      summary: "Guidelines for multi-tenant isolation, database migrations, and PCI compliance boundaries.",
    },
    {
      title: "PostgreSQL & Drizzle ORM Convention Matrix",
      category: "Database",
      lastUpdated: "3 days ago",
      summary: "Standard naming conventions, foreign key indexing strategies, and soft delete specifications.",
    },
  ];

  return (
    <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full font-mono">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="text-xs font-bold text-mutedForeground uppercase">
            ORGANIZATION MEMORY // AGENT CONTEXT
          </div>
          <h1 className="text-xl font-bold font-sans text-foreground mt-1">
            Knowledge Base
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {documents.map((doc, i) => (
          <Card key={i} variant="default" className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="accent" size="sm">
                {doc.category}
              </Badge>
              <span className="text-[10px] text-mutedForeground">{doc.lastUpdated}</span>
            </div>
            <h2 className="text-sm font-semibold text-foreground font-sans">
              {doc.title}
            </h2>
            <p className="text-xs text-mutedForeground leading-relaxed">
              {doc.summary}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
