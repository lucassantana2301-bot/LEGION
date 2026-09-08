"use client";

import React from "react";
import { Cpu, CheckCircle2, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function IntegrationsPage() {
  const integrations = [
    {
      name: "Isolated Docker / Firecracker Sandbox",
      type: "Runtime Provider",
      status: "CONTRACT READY",
      description: "Secure, ephemeral container runtime executing agent commands with network isolation.",
    },
    {
      name: "GitHub / GitLab Provider",
      type: "VCS Provider",
      status: "CONTRACT READY",
      description: "Automated branch creation, pull request generation, and commit signature verification.",
    },
    {
      name: "OpenAI / Anthropic / Gemini Router",
      type: "LLM Provider",
      status: "CONTRACT READY",
      description: "Model-agnostic multi-provider routing with fallback and token budgeting.",
    },
    {
      name: "Vercel / AWS Deployment Engine",
      type: "Deploy Provider",
      status: "CONTRACT READY",
      description: "Automated preview environment staging and zero-downtime production deployment.",
    },
  ];

  return (
    <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full font-mono">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="text-xs font-bold text-mutedForeground uppercase">
            PROVIDER ABSTRACTIONS // ECOSYSTEM
          </div>
          <h1 className="text-xl font-bold font-sans text-foreground mt-1">
            Integrations & Providers
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((item, i) => (
          <Card key={i} variant="default" className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="outline" size="sm">
                {item.type}
              </Badge>
              <Badge variant="accent" size="sm">
                {item.status}
              </Badge>
            </div>
            <h2 className="text-sm font-semibold text-foreground font-sans">
              {item.name}
            </h2>
            <p className="text-xs text-mutedForeground leading-relaxed">
              {item.description}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
