"use client";

import React, { useState, useRef } from "react";
import { Play, Square, ShieldCheck, Cpu, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { legionEventBus } from "@/lib/events/bus";
import { useMissionStore } from "@/stores/mission-store";

export const RealExecutionCard: React.FC = () => {
  const { mission } = useMissionStore();
  const [executionState, setExecutionState] = useState<"IDLE" | "RUNNING" | "COMPLETE" | "ERROR" | "CANCELLED">("IDLE");
  const [activeProvider, setActiveProvider] = useState<string>("E2B / Mock");
  const [statusMessage, setStatusMessage] = useState<string>("Ready for isolated execution");
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleRunDiagnostic = async () => {
    if (executionState === "RUNNING") return;

    setExecutionState("RUNNING");
    setStatusMessage("Allocating sandbox & executing real diagnostic pipeline...");

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch("/api/sandbox/diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ missionId: mission.id }),
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);

            if (data.event) {
              // Dispatch typed event to client bus so terminal & activity feed react in real-time!
              legionEventBus.emit(data.event);

              if (data.event.type === "SANDBOX_CREATED" && data.event.provider) {
                setActiveProvider(data.event.provider);
              }
              if (data.event.message) {
                setStatusMessage(data.event.message);
              }
            }

            if (data.summary) {
              if (data.summary.status === "SUCCESS") {
                setExecutionState("COMPLETE");
                setStatusMessage(`Diagnostic completed successfully (${data.summary.totalDurationMs}ms).`);
              } else if (data.summary.status === "CANCELLED") {
                setExecutionState("CANCELLED");
                setStatusMessage("Execution was cancelled by user.");
              } else {
                setExecutionState("ERROR");
                setStatusMessage("Diagnostic encountered a verification failure.");
              }
            }

            if (data.error) {
              setExecutionState("ERROR");
              setStatusMessage(`Error: ${data.error}`);
            }
          } catch {
            // Partial JSON line ignore
          }
        }
      }
    } catch (err: unknown) {
      if (abortController.signal.aborted) {
        setExecutionState("CANCELLED");
        setStatusMessage("Execution cancelled.");
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setExecutionState("ERROR");
        setStatusMessage(`Execution failed: ${msg}`);
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleStopExecution = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setExecutionState("CANCELLED");
      setStatusMessage("Cancellation signal sent to sandbox provider.");
    }
  };

  return (
    <Card variant="raised" className="p-4 border-border">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-borderMuted mb-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-accent" />
          <h3 className="text-xs font-mono font-bold tracking-wider text-mutedForeground uppercase">
            REAL EXECUTION // SANDBOX RUNTIME
          </h3>
          <Badge variant="accent" size="sm">
            PHASE 02B
          </Badge>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-mutedForeground">
            <span>Provider:</span>
            <strong className="text-foreground">{activeProvider}</strong>
          </div>
          <span className="text-mutedForeground">|</span>
          <div className="flex items-center gap-1.5">
            <StatusDot
              status={executionState === "RUNNING" ? "WORKING" : executionState === "COMPLETE" ? "READY" : "IDLE"}
              pulse={executionState === "RUNNING"}
            />
            <span className="text-[11px] font-bold uppercase text-foreground">
              {executionState}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck className="w-4 h-4 text-success shrink-0" />
          <span className="text-mutedForeground truncate">
            {statusMessage}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {executionState === "RUNNING" ? (
            <Button
              variant="danger"
              size="sm"
              onClick={handleStopExecution}
              icon={<Square className="w-3.5 h-3.5" />}
            >
              STOP EXECUTION
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleRunDiagnostic}
              icon={<Play className="w-3.5 h-3.5" />}
            >
              RUN DIAGNOSTIC
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};
