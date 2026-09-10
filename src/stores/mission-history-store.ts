"use client";

import { create } from "zustand";

export interface HistoricMission {
  id: string;
  title: string;
  prompt: string;
  status: "PLANNING" | "RUNNING" | "VALIDATING" | "COMPLETED" | "FAILED" | "CANCELLED";
  createdAt: string;
  durationMs: number;
  tasksCount: number;
  qaResult: "PASSED" | "FAILED" | "MOCK" | "NONE";
  provider: "E2B" | "MOCK";
  model: string;
  totalTokens: number;
  totalCostUsd: number;
  filesCount: number;
  summary?: string;
}

const INITIAL_MISSIONS: HistoricMission[] = [
  {
    id: "mission-001",
    title: "Autonomous Task Pipeline with Dynamic DAG Resolution",
    prompt: "Create a TypeScript utility that calculates fibonacci numbers and verify it with automated tests.",
    status: "COMPLETED",
    createdAt: new Date(Date.now() - 3600_000 * 2).toISOString(),
    durationMs: 42_500,
    tasksCount: 4,
    qaResult: "PASSED",
    provider: "E2B",
    model: "Google Gemini 1.5 Pro",
    totalTokens: 14_850,
    totalCostUsd: 0.0148,
    filesCount: 6,
    summary: "Successfully built and validated Fibonacci pipeline with 100% test coverage and TS strict mode.",
  },
  {
    id: "mission-002",
    title: "Secure JWT Authentication & Role Authorization Middleware",
    prompt: "Implement robust JWT authentication with refresh tokens, rate limiting, and password hashing in Node.js.",
    status: "COMPLETED",
    createdAt: new Date(Date.now() - 3600_000 * 6).toISOString(),
    durationMs: 78_200,
    tasksCount: 6,
    qaResult: "PASSED",
    provider: "E2B",
    model: "Google Gemini 1.5 Pro",
    totalTokens: 28_400,
    totalCostUsd: 0.0284,
    filesCount: 11,
    summary: "Architected and verified cryptographic auth middleware passing automated security assertions.",
  },
  {
    id: "mission-003",
    title: "Distributed Memory Cache with SHA-256 Digest Verification",
    prompt: "Create an in-memory canonical workspace cache with SHA-256 digest reconciliation and conflict detection.",
    status: "COMPLETED",
    createdAt: new Date(Date.now() - 3600_000 * 18).toISOString(),
    durationMs: 61_100,
    tasksCount: 5,
    qaResult: "PASSED",
    provider: "E2B",
    model: "Google Gemini 1.5 Pro",
    totalTokens: 22_100,
    totalCostUsd: 0.0221,
    filesCount: 8,
    summary: "Integrated workspace reconciliation engine with cryptographic readback integrity.",
  },
  {
    id: "mission-004",
    title: "Event-Driven Webhook Dispatcher with Dead Letter Queue",
    prompt: "Build an event bus dispatcher that supports async retries, backoff policies, and dead letter persistence.",
    status: "FAILED",
    createdAt: new Date(Date.now() - 3600_000 * 30).toISOString(),
    durationMs: 34_800,
    tasksCount: 3,
    qaResult: "FAILED",
    provider: "E2B",
    model: "Google Gemini 1.5 Pro",
    totalTokens: 11_200,
    totalCostUsd: 0.0112,
    filesCount: 4,
    summary: "Validation failed during Sentinel review due to unhandled retry timeout exception.",
  },
];

interface MissionHistoryState {
  missions: HistoricMission[];
  addMission: (mission: HistoricMission) => void;
  updateMissionStatus: (
    id: string,
    status: HistoricMission["status"],
    updates?: Partial<HistoricMission>
  ) => void;
  getMissionById: (id: string) => HistoricMission | undefined;
}

export const useMissionHistoryStore = create<MissionHistoryState>((set, get) => ({
  missions: INITIAL_MISSIONS,

  addMission: (mission) => {
    set((state) => {
      const filtered = state.missions.filter((m) => m.id !== mission.id);
      return { missions: [mission, ...filtered] };
    });
  },

  updateMissionStatus: (id, status, updates = {}) => {
    set((state) => ({
      missions: state.missions.map((m) =>
        m.id === id ? { ...m, status, ...updates } : m
      ),
    }));
  },

  getMissionById: (id) => {
    return get().missions.find((m) => m.id === id);
  },
}));
