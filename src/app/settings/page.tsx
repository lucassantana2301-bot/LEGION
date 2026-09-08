"use client";

import React, { useState } from "react";
import { Settings, Save, ShieldAlert, Key } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const [maxIterations, setMaxIterations] = useState("50");
  const [maxCost, setMaxCost] = useState("10.00");
  const [requireApprovals, setRequireApprovals] = useState(true);

  return (
    <div className="flex-1 p-6 space-y-6 max-w-4xl mx-auto w-full font-mono">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="text-xs font-bold text-mutedForeground uppercase">
            PLATFORM CONFIGURATION
          </div>
          <h1 className="text-xl font-bold font-sans text-foreground mt-1">
            Settings & Guardrails
          </h1>
        </div>

        <Button variant="primary" size="md" icon={<Save className="w-4 h-4" />}>
          SAVE CONFIGURATION
        </Button>
      </div>

      <div className="space-y-6">
        {/* Guardrails */}
        <Card variant="raised" className="p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-borderMuted">
            <ShieldAlert className="w-4 h-4 text-warning" />
            <h2 className="text-sm font-bold text-foreground font-sans">
              Execution Safety & Circuit Breakers
            </h2>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-mutedForeground mb-1 font-semibold">
                Maximum Iteration Depth per Mission
              </label>
              <input
                type="number"
                value={maxIterations}
                onChange={(e) => setMaxIterations(e.target.value)}
                className="w-full max-w-xs bg-surface border border-border focus:border-accent rounded px-3 py-2 text-foreground font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-mutedForeground mb-1 font-semibold">
                Maximum Cost Ceiling (USD)
              </label>
              <input
                type="text"
                value={maxCost}
                onChange={(e) => setMaxCost(e.target.value)}
                className="w-full max-w-xs bg-surface border border-border focus:border-accent rounded px-3 py-2 text-foreground font-mono focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="approvals"
                checked={requireApprovals}
                onChange={(e) => setRequireApprovals(e.target.checked)}
                className="rounded border-border bg-surface text-accent focus:ring-0"
              />
              <label htmlFor="approvals" className="text-foreground text-xs font-semibold cursor-pointer">
                Enforce human-in-the-loop approval on database migrations & production actions
              </label>
            </div>
          </div>
        </Card>

        {/* API Credentials */}
        <Card variant="raised" className="p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-borderMuted">
            <Key className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-bold text-foreground font-sans">
              Provider API Credentials
            </h2>
          </div>

          <p className="text-xs text-mutedForeground leading-relaxed">
            API keys are configured via server-side environment variables (e.g. <code>.env.local</code>) and are never exposed or stored client-side in the browser.
          </p>
        </Card>
      </div>
    </div>
  );
}
