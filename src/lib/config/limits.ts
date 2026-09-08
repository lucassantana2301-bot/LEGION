// Execution guardrails read from environment configuration (see .env.example).
//
// Only MAX_MISSION_ITERATIONS has a real enforcement point today (the mission
// engine's step loop). MAX_AGENT_RETRIES, MAX_MISSION_COST_USD, and
// SANDBOX_TIMEOUT_MS have no actual retry loop, cost accumulator, or sandbox
// call to attach to yet — wiring enforcement for those now would be
// speculative. They will be enforced once Phase 02B/02D introduce the real
// agent/sandbox execution they govern.

export interface ExecutionLimits {
  maxMissionIterations: number;
}

const DEFAULT_MAX_MISSION_ITERATIONS = 50;

export function getExecutionLimits(): ExecutionLimits {
  const raw = process.env.MAX_MISSION_ITERATIONS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return {
    maxMissionIterations: Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_MISSION_ITERATIONS,
  };
}
