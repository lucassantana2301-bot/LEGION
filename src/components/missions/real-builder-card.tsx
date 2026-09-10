"use client";

import React, { useState, useRef } from "react";
import { Play, Square, Bot, Terminal, CheckCircle2, AlertTriangle, Sparkles, FileCode2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { legionEventBus } from "@/lib/events/bus";
import { useMissionStore } from "@/stores/mission-store";

export const RealBuilderCard: React.FC = () => {
  const { mission } = useMissionStore();
  const [taskPrompt, setTaskPrompt] = useState<string>(
    "Create a file hello.ts that prints LEGION ONLINE, execute it, and verify it runs successfully."
  );
  const [builderState, setBuilderState] = useState<
    "IDLE" | "THINKING" | "WRITING FILE" | "EXECUTING" | "VERIFYING" | "COMPLETED" | "FAILED" | "CANCELLED"
  >("IDLE");
  const [statusMessage, setStatusMessage] = useState<string>("Ready for engineering mission");
  const [telemetry, setTelemetry] = useState<{
    iterations?: number;
    tokens?: number;
    durationMs?: number;
    costUsd?: number;
  }>({});

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleRunBuilder = async () => {
    if (builderState !== "IDLE" && builderState !== "COMPLETED" && builderState !== "FAILED" && builderState !== "CANCELLED") {
      return;
    }

    setBuilderState("THINKING");
    setStatusMessage("Initializing Builder agent and allocating isolated sandbox...");
    setTelemetry({});

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch("/api/agent/builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          missionId: mission.id,
          taskPrompt,
        }),
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

            // Stream end with final telemetry
            if (data.type === "STREAM_END") {
              if (data.result) {
                const res = data.result;
                setTelemetry({
                  iterations: res.iterations,
                  tokens: res.totalTokens?.total,
                  durationMs: res.durationMs,
                  costUsd: res.totalCostUsd,
                });
                if (res.status === "SUCCESS") {
                  setBuilderState("COMPLETED");
                  setStatusMessage(`Task completed successfully in ${res.durationMs}ms.`);
                } else if (res.status === "CANCELLED") {
                  setBuilderState("CANCELLED");
                  setStatusMessage("Task cancelled by user.");
                } else {
                  setBuilderState("FAILED");
                  setStatusMessage(`Task failed: ${res.error || "Unknown error"}`);
                }
              }
              continue;
            }

            // Dispatch event to client bus so terminal & live feed receive real-time updates!
            legionEventBus.emit(data);

            if (data.type === "AGENT_THINKING") {
              setBuilderState("THINKING");
              if (data.message) setStatusMessage(data.message);
            } else if (data.type === "FILE_CREATED" || data.type === "FILE_MODIFIED") {
              setBuilderState("WRITING FILE");
              if (data.message) setStatusMessage(data.message);
            } else if (data.type === "EXECUTION_STARTED") {
              setBuilderState("EXECUTING");
              if (data.message) setStatusMessage(data.message);
            } else if (data.type === "EXECUTION_COMPLETED") {
              setBuilderState("VERIFYING");
              if (data.message) setStatusMessage(data.message);
            } else if (data.type === "AGENT_COMPLETED") {
              setBuilderState("COMPLETED");
              if (data.message) setStatusMessage(data.message);
            } else if (data.type === "AGENT_FAILED") {
              setBuilderState("FAILED");
              if (data.message) setStatusMessage(data.message);
            }
          } catch {
            // Ignore incomplete JSON stream lines
          }
        }
      }
    } catch (err: unknown) {
      if (abortController.signal.aborted) {
        setBuilderState("CANCELLED");
        setStatusMessage("Execution cancelled.");
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setBuilderState("FAILED");
        setStatusMessage(`Builder error: ${msg}`);
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleStopBuilder = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setBuilderState("CANCELLED");
      setStatusMessage("Cancellation signal sent to Builder agent.");
    }
  };

  const isRunning =
    builderState === "THINKING" ||
    builderState === "WRITING FILE" ||
    builderState === "EXECUTING" ||
    builderState === "VERIFYING";

  return (
    <Card variant="raised" className="p-4 border-border">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-borderMuted mb-3">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-accent" />
          <h3 className="text-xs font-mono font-bold tracking-wider text-mutedForeground uppercase">
            REAL BUILDER AGENT // LLM ENGINE
          </h3>
          <Badge variant="accent" size="sm">
            PHASE 02C
          </Badge>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          {telemetry.tokens !== undefined && (
            <div className="text-mutedForeground">
              Tokens: <strong className="text-foreground">{telemetry.tokens}</strong>
            </div>
          )}
          {telemetry.iterations !== undefined && (
            <div className="text-mutedForeground">
              Iterations: <strong className="text-foreground">{telemetry.iterations}</strong>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <StatusDot
              status={isRunning ? "WORKING" : builderState === "COMPLETED" ? "READY" : "IDLE"}
              pulse={isRunning}
            />
            <span className="text-[11px] font-bold uppercase text-foreground">
              {builderState}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={taskPrompt}
              onChange={(e) => setTaskPrompt(e.target.value)}
              disabled={isRunning}
              placeholder="Describe engineering task for Builder..."
              className="w-full bg-surface border border-border rounded px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-mutedForeground focus:outline-none focus:border-accent disabled:opacity-60"
            />
          </div>

          <div className="shrink-0">
            {isRunning ? (
              <Button
                variant="danger"
                size="sm"
                onClick={handleStopBuilder}
                icon={<Square className="w-3.5 h-3.5" />}
              >
                STOP BUILDER
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleRunBuilder}
                icon={<Play className="w-3.5 h-3.5" />}
              >
                RUN BUILDER
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs font-mono text-mutedForeground">
          <div className="flex items-center gap-2 truncate">
            {builderState === "COMPLETED" ? (
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            ) : builderState === "FAILED" ? (
              <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-accent shrink-0" />
            )}
            <span className="truncate">{statusMessage}</span>
          </div>

          {telemetry.durationMs !== undefined && (
            <div className="shrink-0 text-[11px] text-mutedForeground">
              Total: {telemetry.durationMs}ms
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
