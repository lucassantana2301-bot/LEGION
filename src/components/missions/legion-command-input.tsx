"use client";

import React, { useState } from "react";
import { Send, Terminal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMissionSlice } from "@/stores/mission-slice";

export const LegionCommandInput: React.FC = () => {
  const [command, setCommand] = useState("");
  const sendUserCommand = useMissionSlice((s) => s.sendUserCommand);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;
    sendUserCommand(command.trim());
    setCommand("");
  };

  const suggestions = [
    "Prioritize authentication.",
    "Pause deployment tasks.",
    "Explain why Task #008 failed.",
    "Ask Sentinel to retest.",
  ];

  return (
    <div className="bg-surface rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-accent" />
          <span className="text-xs font-mono font-bold tracking-wider text-mutedForeground uppercase">
            LEGION COMMAND // INTERVENE
          </span>
        </div>
        <span className="text-[10px] font-mono text-mutedForeground">
          Direct human instruction to Commander
        </span>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Instruct Commander (e.g. 'Prioritize auth', 'Explain failure', 'Ask Sentinel to retest')..."
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            className="w-full bg-surfaceRaised border border-border focus:border-accent rounded-md px-3.5 py-2 text-xs font-mono text-foreground placeholder:text-mutedForeground focus:outline-none"
          />
        </div>
        <Button variant="primary" size="md" type="submit" icon={<Send className="w-3.5 h-3.5" />}>
          SEND
        </Button>
      </form>

      {/* Suggested quick commands */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
        <span className="text-[10px] font-mono text-mutedForeground flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-accent" /> Quick:
        </span>
        {suggestions.map((sug, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setCommand(sug)}
            className="text-[10px] font-mono px-2 py-0.5 rounded bg-surfaceRaised hover:bg-surfaceOverlay border border-border text-mutedForeground hover:text-foreground transition-colors"
          >
            {sug}
          </button>
        ))}
      </div>
    </div>
  );
};
