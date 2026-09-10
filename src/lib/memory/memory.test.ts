// LEGION Phase 09 — Mission Memory & Shared Context Comprehensive Test Suite
// Validates mission-scoped memory, context retrieval, budget enforcement, sanitization, isolation, and orchestrator integration

import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryMissionMemoryStore } from "./memory-store";
import { MissionContextRetriever } from "./context-retriever";
import { sanitizeMemoryContent, sanitizeMemoryMetadata } from "./sanitizer";
import {
  MissionMemoryEntry,
  MissionMemorySnapshot,
  MissionMemoryType,
} from "./types";
import { LegionOrchestrator } from "../agent/orchestrator";
import { CommanderAgent } from "../agent/commander-agent";
import { BuilderAgent } from "../agent/builder-agent";
import { SentinelAgent } from "../agent/sentinel-agent";
import { ArchitectAgent } from "../agent/architect-agent";
import { MockLLMProvider } from "../providers/llm";
import { MockSandboxProvider } from "../providers/sandbox";
import { legionEventBus } from "../events/bus";

function createMockLLM(content: string): MockLLMProvider {
  const provider = new MockLLMProvider();
  provider.enqueueResponse({
    content,
    finishReason: "stop",
    provider: "mock-llm-provider",
    model: "mock-model",
    tokens: { prompt: 10, completion: 10, total: 20 },
  });
  return provider;
}

describe("PHASE 09 — MISSION MEMORY & SHARED CONTEXT", () => {
  let store: InMemoryMissionMemoryStore;
  let retriever: MissionContextRetriever;

  beforeEach(() => {
    store = new InMemoryMissionMemoryStore();
    retriever = new MissionContextRetriever(store);
  });

  // 1. Append basic entry
  it("1. should append a valid memory entry with generated ID and timestamp", async () => {
    const entry = await store.append({
      missionId: "mission-1",
      agentRole: "COMMANDER",
      type: "MISSION_REQUIREMENT",
      title: "Build REST API",
      content: "Must support users and auth endpoints",
      tags: ["api", "auth"],
      importance: "HIGH",
    });

    expect(entry.id).toBeDefined();
    expect(entry.id.startsWith("mem_")).toBe(true);
    expect(entry.missionId).toBe("mission-1");
    expect(entry.agentRole).toBe("COMMANDER");
    expect(entry.title).toBe("Build REST API");
    expect(entry.createdAt).toBeDefined();
  });

  // 2. Query by missionId
  it("2. should query entries filtered by missionId", async () => {
    await store.append({
      missionId: "mission-alpha",
      agentRole: "ARCHITECT",
      type: "ARCHITECTURE_DECISION",
      title: "Use Clean Architecture",
      content: "Domain layer isolated",
      tags: ["arch"],
      importance: "HIGH",
    });

    await store.append({
      missionId: "mission-alpha",
      agentRole: "BUILDER",
      type: "IMPLEMENTATION_CHANGE",
      title: "Created domain models",
      content: "User entity added",
      tags: ["code"],
      importance: "MEDIUM",
    });

    const entries = await store.query({ missionId: "mission-alpha" });
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.agentRole)).toEqual(["ARCHITECT", "BUILDER"]);
  });

  // 3. Mission Isolation
  it("3. should strictly isolate memories across different missions", async () => {
    await store.append({
      missionId: "mission-A",
      agentRole: "COMMANDER",
      type: "MISSION_REQUIREMENT",
      title: "Private Secret Project A",
      content: "Confidential details for project A",
      tags: ["confidential"],
      importance: "CRITICAL",
    });

    await store.append({
      missionId: "mission-B",
      agentRole: "COMMANDER",
      type: "MISSION_REQUIREMENT",
      title: "Public Project B",
      content: "Open details for project B",
      tags: ["public"],
      importance: "LOW",
    });

    const entriesA = await store.getAllForMission("mission-A");
    const entriesB = await store.getAllForMission("mission-B");
    const queryA = await store.query({ missionId: "mission-A" });

    expect(entriesA).toHaveLength(1);
    expect(entriesA[0].title).toBe("Private Secret Project A");

    expect(entriesB).toHaveLength(1);
    expect(entriesB[0].title).toBe("Public Project B");

    expect(queryA.some((e) => e.missionId === "mission-B")).toBe(false);
  });

  // 4. Query by taskId
  it("4. should query entries by specific taskId", async () => {
    await store.append({
      missionId: "m-1",
      taskId: "task-101",
      agentRole: "BUILDER",
      type: "IMPLEMENTATION_CHANGE",
      title: "Task 101 Changes",
      content: "Done task 101",
      tags: ["t101"],
      importance: "MEDIUM",
    });

    await store.append({
      missionId: "m-1",
      taskId: "task-102",
      agentRole: "BUILDER",
      type: "IMPLEMENTATION_CHANGE",
      title: "Task 102 Changes",
      content: "Done task 102",
      tags: ["t102"],
      importance: "MEDIUM",
    });

    const results = await store.query({ missionId: "m-1", taskId: "task-101" });
    expect(results).toHaveLength(1);
    expect(results[0].taskId).toBe("task-101");
  });

  // 5. Query by AgentRole
  it("5. should query entries by AgentRole", async () => {
    await store.append({
      missionId: "m-1",
      agentRole: "SENTINEL",
      type: "SENTINEL_FINDING",
      title: "Review Passed",
      content: "All tests green",
      tags: ["qa"],
      importance: "HIGH",
    });

    await store.append({
      missionId: "m-1",
      agentRole: "BUILDER",
      type: "TASK_RESULT",
      title: "Build Succeeded",
      content: "Compiled 5 files",
      tags: ["build"],
      importance: "MEDIUM",
    });

    const sentinelResults = await store.query({
      missionId: "m-1",
      agentRole: "SENTINEL",
    });
    expect(sentinelResults).toHaveLength(1);
    expect(sentinelResults[0].agentRole).toBe("SENTINEL");
  });

  // 6. Importance ordering
  it("6. should filter and prioritize by importance levels", async () => {
    await store.append({
      missionId: "m-imp",
      agentRole: "COMMANDER",
      type: "MISSION_REQUIREMENT",
      title: "Low importance note",
      content: "Minor detail",
      tags: [],
      importance: "LOW",
    });

    await store.append({
      missionId: "m-imp",
      agentRole: "ARCHITECT",
      type: "ARCHITECTURE_DECISION",
      title: "Critical architecture boundary",
      content: "Never import DB into frontend",
      tags: [],
      importance: "CRITICAL",
    });

    await store.append({
      missionId: "m-imp",
      agentRole: "SENTINEL",
      type: "ISSUE",
      title: "High severity vulnerability",
      content: "SQL injection risk",
      tags: [],
      importance: "HIGH",
    });

    const criticalOnly = await store.query({
      missionId: "m-imp",
      minImportance: "CRITICAL",
    });
    expect(criticalOnly).toHaveLength(1);
    expect(criticalOnly[0].title).toBe("Critical architecture boundary");

    const highAndAbove = await store.query({
      missionId: "m-imp",
      minImportance: "HIGH",
    });
    expect(highAndAbove).toHaveLength(2);
  });

  // 7. Dependency Relevance in Context Retrieval
  it("7. should score dependency tasks higher when retrieving context", async () => {
    // Task 1: Architecture setup
    await store.append({
      missionId: "m-dag",
      taskId: "task-01",
      agentRole: "ARCHITECT",
      type: "ARCHITECTURE_DECISION",
      title: "DB Schema Design",
      content: "Postgres schema with users table",
      tags: ["schema"],
      importance: "HIGH",
    });

    // Task 2: Unrelated task
    await store.append({
      missionId: "m-dag",
      taskId: "task-99",
      agentRole: "BUILDER",
      type: "TASK_RESULT",
      title: "Unrelated CSS tweak",
      content: "Updated button padding",
      tags: ["css"],
      importance: "LOW",
    });

    // Task 3: Builder depends on task-01
    const retrieved = await retriever.getRelevantContext({
      missionId: "m-dag",
      taskId: "task-02",
      dependencies: ["task-01"],
      assignedRole: "BUILDER",
      tags: ["schema"],
    });

    expect(retrieved.entries.length).toBeGreaterThanOrEqual(1);
    expect(retrieved.entries[0].taskId).toBe("task-01");
    expect(retrieved.formattedContext).toContain("DB Schema Design");
  });

  // 8. Context Budget enforcement
  it("8. should strictly respect maxEntries and maxCharacters limits", async () => {
    for (let i = 1; i <= 20; i++) {
      await store.append({
        missionId: "m-budget",
        taskId: `task-${i}`,
        agentRole: "BUILDER",
        type: "IMPLEMENTATION_CHANGE",
        title: `Task ${i} long description of changes made to repository component`,
        content: `Detailed implementation output for task ${i}. `.repeat(10),
        tags: ["budget"],
        importance: i % 2 === 0 ? "HIGH" : "MEDIUM",
      });
    }

    // Limit to 4 entries
    const byEntries = await retriever.getRelevantContext({
      missionId: "m-budget",
      maxEntries: 4,
    });
    expect(byEntries.entries.length).toBe(4);

    // Limit to small character count
    const byChars = await retriever.getRelevantContext({
      missionId: "m-budget",
      maxEntries: 20,
      maxCharacters: 500,
    });
    expect(byChars.totalCharacters).toBeLessThanOrEqual(650);
  });

  // 9. Deterministic retrieval
  it("9. should produce deterministic context ranking given identical inputs", async () => {
    await store.append({
      missionId: "m-det",
      taskId: "t-1",
      agentRole: "ARCHITECT",
      type: "ARCHITECTURE_DECISION",
      title: "Decision A",
      content: "Content A",
      tags: ["arch"],
      importance: "HIGH",
    });

    await store.append({
      missionId: "m-det",
      taskId: "t-2",
      agentRole: "SENTINEL",
      type: "SENTINEL_FINDING",
      title: "Finding B",
      content: "Content B",
      tags: ["qa"],
      importance: "HIGH",
    });

    const res1 = await retriever.getRelevantContext({
      missionId: "m-det",
      taskId: "t-3",
      assignedRole: "BUILDER",
    });

    const res2 = await retriever.getRelevantContext({
      missionId: "m-det",
      taskId: "t-3",
      assignedRole: "BUILDER",
    });

    expect(res1.entries.map((e) => e.id)).toEqual(res2.entries.map((e) => e.id));
    expect(res1.formattedContext).toBe(res2.formattedContext);
  });

  // 10. Architect -> Builder memory flow
  it("10. should allow Builder to retrieve Architect design blueprints and interfaces", async () => {
    await store.append({
      missionId: "m-arch-builder",
      taskId: "task-design",
      agentRole: "ARCHITECT",
      type: "INTERFACE_CONTRACT",
      title: "AuthService Contract",
      content: "export interface AuthService { login(user: string): Promise<boolean>; }",
      tags: ["interface", "auth"],
      importance: "CRITICAL",
    });

    const retrieved = await retriever.getRelevantContext({
      missionId: "m-arch-builder",
      taskId: "task-impl",
      dependencies: ["task-design"],
      assignedRole: "BUILDER",
      tags: ["auth"],
    });

    expect(retrieved.formattedContext).toContain("AuthService Contract");
    expect(retrieved.formattedContext).toContain("INTERFACE_CONTRACT");
    expect(retrieved.formattedContext).toContain("login(user: string)");
  });

  // 11. Sentinel -> Builder retry memory flow
  it("11. should inject Sentinel QA issues and recommendations for Builder retry", async () => {
    await store.append({
      missionId: "m-retry",
      taskId: "task-payment",
      agentRole: "SENTINEL",
      type: "ISSUE",
      title: "Missing input validation",
      content: "Amount must be strictly positive integer",
      tags: ["issue", "critical"],
      importance: "CRITICAL",
    });

    await store.append({
      missionId: "m-retry",
      taskId: "task-payment",
      agentRole: "SENTINEL",
      type: "LESSON",
      title: "Payment Validation Rule",
      content: "Add Zod schema for payment payloads",
      tags: ["lesson"],
      importance: "MEDIUM",
    });

    const retrieved = await retriever.getRelevantContext({
      missionId: "m-retry",
      taskId: "task-payment",
      assignedRole: "BUILDER",
    });

    expect(retrieved.formattedContext).toContain("Missing input validation");
    expect(retrieved.formattedContext).toContain("Amount must be strictly positive integer");
  });

  // 12. Builder results registered
  it("12. should register Builder implementation changes and output", async () => {
    const entry = await store.append({
      missionId: "m-builder",
      taskId: "task-feat",
      agentRole: "BUILDER",
      type: "IMPLEMENTATION_CHANGE",
      title: "Created user controller",
      content: "Files: src/controllers/user.ts",
      tags: ["controller", "user"],
      importance: "HIGH",
    });

    expect(entry.type).toBe("IMPLEMENTATION_CHANGE");
    expect(entry.agentRole).toBe("BUILDER");
  });

  // 13. Commander decisions registered
  it("13. should register Commander requirements and execution strategy", async () => {
    const req = await store.append({
      missionId: "m-cmd",
      agentRole: "COMMANDER",
      type: "MISSION_REQUIREMENT",
      title: "Mission Objective: Deploy Payment Gateway",
      content: "Integrate Stripe and webhook listener",
      tags: ["requirement"],
      importance: "CRITICAL",
    });

    const dec = await store.append({
      missionId: "m-cmd",
      agentRole: "COMMANDER",
      type: "COMMANDER_DECISION",
      title: "Plan strategy",
      content: "Formulated 3 tasks in DAG sequence",
      tags: ["dag"],
      importance: "HIGH",
    });

    expect(req.importance).toBe("CRITICAL");
    expect(dec.type).toBe("COMMANDER_DECISION");
  });

  // 14. Parallel append safety
  it("14. should safely handle concurrent append operations without loss", async () => {
    const promises = Array.from({ length: 50 }, (_, i) =>
      store.append({
        missionId: "m-parallel",
        taskId: `task-${i % 5}`,
        agentRole: i % 2 === 0 ? "BUILDER" : "ARCHITECT",
        type: "TASK_RESULT",
        title: `Concurrent task result ${i}`,
        content: `Payload content ${i}`,
        tags: [`tag-${i}`],
        importance: "MEDIUM",
      })
    );

    const results = await Promise.all(promises);
    expect(results).toHaveLength(50);

    const all = await store.getAllForMission("m-parallel");
    expect(all).toHaveLength(50);
  });

  // 15. Unique IDs across parallel appends
  it("15. should generate unique IDs for all concurrent entries", async () => {
    const entries = await Promise.all(
      Array.from({ length: 100 }, (_, i) =>
        store.append({
          missionId: "m-unique-ids",
          agentRole: "BUILDER",
          type: "TASK_RESULT",
          title: `Result ${i}`,
          content: `Content ${i}`,
          tags: [],
          importance: "LOW",
        })
      )
    );

    const ids = new Set(entries.map((e) => e.id));
    expect(ids.size).toBe(100);
  });

  // 16. Structured Snapshot creation
  it("16. should generate aggregated MissionMemorySnapshot categorized by type", async () => {
    await store.append({
      missionId: "m-snap",
      agentRole: "COMMANDER",
      type: "MISSION_REQUIREMENT",
      title: "Req 1",
      content: "Req content",
      tags: [],
      importance: "CRITICAL",
    });

    await store.append({
      missionId: "m-snap",
      agentRole: "ARCHITECT",
      type: "ARCHITECTURE_DECISION",
      title: "Arch 1",
      content: "Arch content",
      tags: [],
      importance: "HIGH",
    });

    await store.append({
      missionId: "m-snap",
      agentRole: "BUILDER",
      type: "IMPLEMENTATION_CHANGE",
      title: "Impl 1",
      content: "Impl content",
      tags: [],
      importance: "MEDIUM",
    });

    await store.append({
      missionId: "m-snap",
      agentRole: "SENTINEL",
      type: "ISSUE",
      title: "Issue 1",
      content: "Bug found",
      tags: [],
      importance: "HIGH",
    });

    await store.append({
      missionId: "m-snap",
      agentRole: "SENTINEL",
      type: "SENTINEL_FINDING",
      title: "QA 1",
      content: "Review pass",
      tags: [],
      importance: "HIGH",
    });

    const snapshot: MissionMemorySnapshot = await store.snapshot("m-snap");
    expect(snapshot.totalEntries).toBe(5);
    expect(snapshot.requirements).toHaveLength(1);
    expect(snapshot.architecturalDecisions).toHaveLength(1);
    expect(snapshot.implementationSummary).toHaveLength(1);
    expect(snapshot.issues).toHaveLength(1);
    expect(snapshot.sentinelFindings).toHaveLength(1);
  });

  // 17. Secret sanitization (OpenAI / Anthropic / Google / E2B)
  it("17. should sanitize API keys before persisting to memory", async () => {
    const rawContent = `Connecting to provider with sk-1234567890abcdef1234567890abcdef and AIzaSyDfakeGoogleKey1234567890abcdef`;
    const sanitized = sanitizeMemoryContent(rawContent);

    expect(sanitized).not.toContain("sk-1234567890abcdef1234567890abcdef");
    expect(sanitized).not.toContain("AIzaSyDfakeGoogleKey1234567890abcdef");
    expect(sanitized).toContain("[REDACTED_API_KEY]");

    const entry = await store.append({
      missionId: "m-sec",
      agentRole: "BUILDER",
      type: "IMPLEMENTATION_CHANGE",
      title: "Anthropic key sk-ant-api03-abcdefghijklmnopqrstuvwxyz12345",
      content: rawContent,
      tags: ["sk-proj-secret12345678901234567890"],
      importance: "LOW",
    });

    expect(entry.title).toContain("[REDACTED_API_KEY]");
    expect(entry.content).toContain("[REDACTED_API_KEY]");
    expect(entry.tags[0]).toContain("[REDACTED_API_KEY]");
  });

  // 18. API key & Bearer token sanitization
  it("18. should redact Bearer authorization headers and private keys", () => {
    const text = `Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ID5_KD\n-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0\n-----END RSA PRIVATE KEY-----`;
    const sanitized = sanitizeMemoryContent(text);

    expect(sanitized).not.toContain("Bearer eyJ");
    expect(sanitized).not.toContain("BEGIN RSA PRIVATE KEY");
    expect(sanitized).toContain("[REDACTED_BEARER_TOKEN]");
    expect(sanitized).toContain("[REDACTED_PRIVATE_KEY]");
  });

  // 19. Env variable sanitization
  it("19. should redact secret environment variables and connection strings", () => {
    const envText = `DATABASE_URL=postgres://admin:superSecretPass123@db.host.internal:5432/prod\nOPENAI_API_KEY="sk-someSecretKey"\nE2B_API_KEY=e2b_9876543210abcdef`;
    const sanitized = sanitizeMemoryContent(envText);

    expect(sanitized).not.toContain("superSecretPass123");
    expect(sanitized).not.toContain("e2b_9876543210abcdef");
    expect(sanitized).toContain("[REDACTED_SECRET]");
  });

  // 20. Abort/cancel safety without corruption
  it("20. should preserve memory store integrity upon cancellation", async () => {
    const memoryStore = new InMemoryMissionMemoryStore();
    const abortCtrl = new AbortController();

    const mockLLM = createMockLLM("Mock response");
    const mockSandbox = new MockSandboxProvider();

    const commander = new CommanderAgent({ llm: mockLLM });
    const builder = new BuilderAgent({ llm: mockLLM, sandbox: mockSandbox });
    const sentinel = new SentinelAgent({ llm: mockLLM });

    const orchestrator = new LegionOrchestrator({
      commander,
      builder,
      sentinel,
      memoryStore,
    });

    abortCtrl.abort();

    const result = await orchestrator.run({
      missionId: "m-cancelled",
      missionPrompt: "Quick task",
      sandboxId: "sbx-test",
      signal: abortCtrl.signal,
    });

    expect(result.status).toBe("CANCELLED");
    expect(result.memorySnapshot).toBeDefined();
    expect(result.memorySnapshot?.missionId).toBe("m-cancelled");
  });

  // 21. Memory events emission
  it("21. should emit MEMORY_ENTRY_ADDED and CONTEXT_RETRIEVED events", async () => {
    const emittedEvents: any[] = [];
    const unsubscribe = legionEventBus.subscribe("*", (ev: any) => {
      if (
        ev.type === "MEMORY_ENTRY_ADDED" ||
        ev.type === "CONTEXT_RETRIEVED" ||
        ev.type === "MEMORY_SNAPSHOT_CREATED"
      ) {
        emittedEvents.push(ev);
      }
    });

    await store.append({
      missionId: "m-events",
      agentRole: "BUILDER",
      type: "IMPLEMENTATION_CHANGE",
      title: "Event test entry",
      content: "Content",
      tags: [],
      importance: "LOW",
    });

    await retriever.getRelevantContext({
      missionId: "m-events",
      taskId: "task-1",
    });

    await store.snapshot("m-events");

    unsubscribe();

    expect(emittedEvents.some((e) => e.type === "MEMORY_ENTRY_ADDED")).toBe(true);
    expect(emittedEvents.some((e) => e.type === "CONTEXT_RETRIEVED")).toBe(true);
    expect(emittedEvents.some((e) => e.type === "MEMORY_SNAPSHOT_CREATED")).toBe(true);
  });

  // 22. Full Mission Execution with Shared Memory Snapshot
  it("22. should execute full Orchestrator workflow with all agent memories captured in snapshot", async () => {
    const memoryStore = new InMemoryMissionMemoryStore();

    // 1. Mock LLM for Commander planning
    const mockPlanLLM = createMockLLM(
      JSON.stringify({
        title: "Build Weather App",
        summary: "Fullstack weather dashboard",
        requirements: ["Build weather API"],
        constraints: [],
        tasks: [
          {
            id: "task-arch",
            order: 1,
            title: "Design System Architecture",
            description: "Specify API schemas and components",
            assignedRole: "ARCHITECT",
            priority: "HIGH",
            status: "BACKLOG",
            dependencies: [],
            requiredCapabilities: ["architecture"],
            successCriteria: ["API schema defined"],
          },
          {
            id: "task-build",
            order: 2,
            title: "Implement Weather Service",
            description: "Build client fetcher",
            assignedRole: "BUILDER",
            priority: "HIGH",
            status: "BACKLOG",
            dependencies: ["task-arch"],
            requiredCapabilities: ["typescript"],
            successCriteria: ["Service exports fetchWeather"],
          },
        ],
      })
    );
    const commander = new CommanderAgent({ llm: mockPlanLLM });

    // 2. Mock LLM for Architect
    const mockArchLLM = createMockLLM(
      JSON.stringify({
        summary: "Weather API Architecture Blueprint",
        approach: "Use Open-Meteo REST endpoints",
        components: [
          {
            name: "WeatherService",
            purpose: "Fetches hourly forecasts",
            files: ["src/lib/weather.ts"],
            responsibilities: ["fetch", "cache"],
          },
        ],
        interfaces: [
          {
            name: "WeatherForecast",
            description: "Forecast payload",
            definition: "export interface WeatherForecast { temp: number; }",
          },
        ],
        dependencies: [],
        risks: [],
        constraints: ["No external API key needed"],
        implementationSteps: ["Create weather.ts"],
        validationStrategy: "Unit tests",
      })
    );
    const architect = new ArchitectAgent({ llm: mockArchLLM });

    // 3. Mock LLM for Builder
    const mockBuilderLLM = createMockLLM(
      JSON.stringify({
        thought: "Implementing WeatherService according to Architect contract",
        action: "EXECUTE",
        command: "echo 'export function fetchWeather() { return { temp: 22 }; }' > weather.ts",
        filesModified: ["weather.ts"],
        summary: "Created fetchWeather implementation",
      })
    );
    const mockSandbox = new MockSandboxProvider();
    const builder = new BuilderAgent({
      llm: mockBuilderLLM,
      sandbox: mockSandbox,
    });

    // 4. Mock LLM for Sentinel QA
    const mockSentinelLLM = createMockLLM(
      JSON.stringify({
        taskId: "task-build",
        decision: "APPROVED",
        confidence: 0.98,
        summary: "All criteria satisfied and implementation matches architecture.",
        criteriaResults: [
          {
            criterion: "Service exports fetchWeather",
            status: "PASS",
            evidence: "Found export function fetchWeather in weather.ts",
            reason: "Export found",
          },
        ],
        issues: [],
        recommendations: ["Add unit tests in next task"],
      })
    );
    const sentinel = new SentinelAgent({
      llm: mockSentinelLLM,
    });

    const orchestrator = new LegionOrchestrator({
      commander,
      architect,
      builder,
      sentinel,
      sandboxProvider: mockSandbox,
      memoryStore,
      maxConcurrentTasks: 2,
    });

    const result = await orchestrator.run({
      missionId: "m-e2e-memory",
      missionPrompt: "Build weather service",
      sandboxId: "sbx-test",
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.memorySnapshot).toBeDefined();

    const snap = result.memorySnapshot!;
    expect(snap.missionId).toBe("m-e2e-memory");
    expect(snap.totalEntries).toBeGreaterThanOrEqual(4);

    // Verify all 4 agent roles contributed to memory
    const allEntries = await memoryStore.getAllForMission("m-e2e-memory");
    const rolesInStore = new Set(allEntries.map((e) => e.agentRole));

    expect(rolesInStore.has("COMMANDER")).toBe(true);
    expect(rolesInStore.has("ARCHITECT")).toBe(true);
    expect(rolesInStore.has("BUILDER")).toBe(true);
    expect(rolesInStore.has("SENTINEL")).toBe(true);

    // Verify snapshot categorizations
    expect(snap.requirements.length).toBeGreaterThanOrEqual(1);
    expect(snap.architecturalDecisions.length).toBeGreaterThanOrEqual(1);
    expect(snap.implementationSummary.length).toBeGreaterThanOrEqual(1);
    expect(snap.sentinelFindings.length).toBeGreaterThanOrEqual(1);
  });
});
