// Unit Tests for LEGION Phase 07 — ARCHITECT Agent
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArchitectAgent, ARCHITECT_TOOL_DEFINITIONS } from "./architect-agent";
import { LLMProvider, LLMGenerateResult } from "../providers/llm";
import { legionEventBus } from "../events/bus";

function createMockLLM(response: Partial<LLMGenerateResult>): LLMProvider {
  return {
    providerName: "mock-llm",
    defaultModel: "mock-model",
    generate: vi.fn().mockResolvedValue({
      content: response.content || "",
      toolCalls: response.toolCalls,
      tokens: response.tokens || {
        prompt: 120,
        completion: 250,
        total: 370,
      },
      costUsd: response.costUsd ?? 0.0004,
      durationMs: 45,
    }),
  } as unknown as LLMProvider;
}

describe("ArchitectAgent (Phase 07 — Systems & Interface Design)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Arquitetura simples
  it("generates a simple architecture design via tool calling", async () => {
    const mockLLM = createMockLLM({
      toolCalls: [
        {
          id: "call-1",
          name: "submitArchitecturePlan",
          arguments: {
            taskId: "task-arch-001",
            summary: "Simple microservice architecture for user service",
            approach: "Layered architecture with Controller -> Service -> Repository",
            components: [
              {
                name: "UserService",
                purpose: "Handle user business logic",
                responsibilities: ["Validation", "Password hashing"],
                files: ["src/services/user.ts"],
              },
            ],
            interfaces: [
              {
                name: "UserDto",
                description: "Data transfer object for user",
                definition: "export interface UserDto { id: string; email: string; }",
              },
            ],
            dependencies: [
              {
                name: "bcrypt",
                type: "EXTERNAL",
                purpose: "Password hashing",
                versionOrConstraint: "^5.1.0",
              },
            ],
            risks: [
              {
                risk: "High memory usage with heavy bcrypt rounds",
                severity: "LOW",
                mitigation: "Use standard round 10",
              },
            ],
            constraints: ["Stateless HTTP handlers"],
            implementationSteps: ["Define UserDto", "Implement UserService", "Add unit tests"],
            validationStrategy: "Unit tests with 100% service coverage",
          },
        },
      ],
    });

    const architect = new ArchitectAgent({ llm: mockLLM });
    const result = await architect.design({
      missionId: "m-001",
      taskId: "task-arch-001",
      missionPrompt: "Build user service with auth",
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.plan).toBeDefined();
    expect(result.plan?.taskId).toBe("task-arch-001");
    expect(result.plan?.summary).toContain("Simple microservice architecture");
    expect(result.plan?.components).toHaveLength(1);
    expect(result.plan?.interfaces).toHaveLength(1);
    expect(result.plan?.dependencies).toHaveLength(1);
    expect(result.plan?.risks).toHaveLength(1);
    expect(result.plan?.implementationSteps).toHaveLength(3);
  });

  // 2. Arquitetura complexa
  it("generates a complex multi-component architecture with deep topology", async () => {
    const mockLLM = createMockLLM({
      toolCalls: [
        {
          id: "call-2",
          name: "submitArchitecturePlan",
          arguments: {
            taskId: "arch-complex",
            summary: "Event-driven CQRS billing and analytics pipeline",
            approach: "CQRS with event sourcing using transactional outbox pattern",
            components: [
              {
                name: "CommandGateway",
                purpose: "Ingest and validate incoming billing commands",
                responsibilities: ["Idempotency check", "Rate limiting", "Schema validation"],
                files: ["src/billing/gateway.ts"],
              },
              {
                name: "BillingAggregate",
                purpose: "Maintain billing account state invariants",
                responsibilities: ["Balance validation", "Invoice generation"],
                files: ["src/billing/aggregate.ts"],
              },
              {
                name: "AnalyticsProjector",
                purpose: "Project financial read models",
                responsibilities: ["Subscribe to billing events", "Update Redis cache"],
                files: ["src/billing/projector.ts"],
              },
            ],
            interfaces: [
              {
                name: "BillingCommand",
                description: "Base interface for billing mutations",
                definition: "export interface BillingCommand { id: string; accountId: string; amountCents: number; }",
                consumers: ["CommandGateway", "BillingAggregate"],
              },
              {
                name: "BillingEvent",
                description: "Domain event emitted on invoice creation",
                definition: "export interface BillingEvent { eventId: string; type: string; payload: unknown; }",
                consumers: ["AnalyticsProjector"],
              },
            ],
            dependencies: [
              {
                name: "ioredis",
                type: "EXTERNAL",
                purpose: "Fast read model projections",
              },
              {
                name: "EventEmitter",
                type: "INTERNAL",
                purpose: "Local event dispatching",
              },
            ],
            risks: [
              {
                risk: "Eventual consistency lag in read model",
                severity: "HIGH",
                mitigation: "Include version vectors in write confirmations",
              },
            ],
            constraints: ["P99 latency under 50ms", "Zero double-charging tolerance"],
            implementationSteps: [
              "Create BillingCommand and BillingEvent interfaces",
              "Implement CommandGateway with idempotency",
              "Build BillingAggregate domain invariants",
              "Implement AnalyticsProjector and test event flow",
            ],
            validationStrategy: "Deterministic integration tests with event assertion",
          },
        },
      ],
    });

    const architect = new ArchitectAgent({ llm: mockLLM });
    const result = await architect.design({
      missionId: "m-complex",
      taskId: "arch-complex",
      missionPrompt: "Design an enterprise CQRS billing platform",
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.plan?.components).toHaveLength(3);
    expect(result.plan?.interfaces).toHaveLength(2);
    expect(result.plan?.dependencies).toHaveLength(2);
    expect(result.plan?.constraints).toHaveLength(2);
  });

  // 3. Interfaces & Contracts
  it("accurately parses interface definitions and consumers", async () => {
    const mockLLM = createMockLLM({
      toolCalls: [
        {
          id: "call-3",
          name: "submitArchitecturePlan",
          arguments: {
            summary: "API contract definition",
            approach: "Strict type-safe RPC contracts",
            components: [{ name: "ApiClient", purpose: "HTTP consumer", responsibilities: ["fetch"] }],
            interfaces: [
              {
                name: "HealthResponse",
                description: "System health check response",
                definition: "export interface HealthResponse { status: 'OK' | 'DEGRADED'; uptime: number; }",
                consumers: ["MonitoringClient", "HealthRoute"],
              },
            ],
            dependencies: [],
            risks: [],
            constraints: [],
            implementationSteps: ["Implement interface in domain.ts"],
            validationStrategy: "TypeScript strict mode compiler verification",
          },
        },
      ],
    });

    const architect = new ArchitectAgent({ llm: mockLLM });
    const result = await architect.design({ taskId: "task-interfaces" });

    expect(result.status).toBe("SUCCESS");
    expect(result.plan?.interfaces[0].name).toBe("HealthResponse");
    expect(result.plan?.interfaces[0].consumers).toContain("MonitoringClient");
  });

  // 4. Dependências
  it("records internal and external dependencies", async () => {
    const mockLLM = createMockLLM({
      toolCalls: [
        {
          id: "call-4",
          name: "submitArchitecturePlan",
          arguments: {
            summary: "Dependency-heavy integration",
            approach: "Modular adapter pattern",
            components: [{ name: "DatabaseAdapter", purpose: "DB operations", responsibilities: ["query"] }],
            interfaces: [{ name: "DBClient", description: "Database client", definition: "interface DBClient {}" }],
            dependencies: [
              { name: "pg", type: "EXTERNAL", purpose: "PostgreSQL client", versionOrConstraint: "^8.11.0" },
              { name: "config", type: "INTERNAL", purpose: "Env configurations" },
              { name: "Docker", type: "RUNTIME", purpose: "Containerized Postgres" },
            ],
            risks: [],
            constraints: [],
            implementationSteps: ["Setup pg pool"],
            validationStrategy: "Smoke test with pg connection",
          },
        },
      ],
    });

    const architect = new ArchitectAgent({ llm: mockLLM });
    const result = await architect.design({ taskId: "task-deps" });

    expect(result.status).toBe("SUCCESS");
    expect(result.plan?.dependencies).toHaveLength(3);
    expect(result.plan?.dependencies.map((d) => d.type)).toEqual(["EXTERNAL", "INTERNAL", "RUNTIME"]);
  });

  // 5. Riscos
  it("structures architectural risks and mitigations correctly", async () => {
    const mockLLM = createMockLLM({
      toolCalls: [
        {
          id: "call-5",
          name: "submitArchitecturePlan",
          arguments: {
            summary: "High-security vault module",
            approach: "Zero-knowledge encryption layer",
            components: [{ name: "Vault", purpose: "Secure storage", responsibilities: ["Encrypt"] }],
            interfaces: [{ name: "VaultSecret", description: "Secret payload", definition: "interface VaultSecret {}" }],
            dependencies: [],
            risks: [
              {
                risk: "Key leakage in memory dump",
                severity: "CRITICAL",
                mitigation: "Zero out buffers immediately after crypto operations",
              },
              {
                risk: "Timing attacks during key comparison",
                severity: "HIGH",
                mitigation: "Use crypto.timingSafeEqual",
              },
            ],
            constraints: [],
            implementationSteps: ["Use crypto.timingSafeEqual"],
            validationStrategy: "Security penetration and timing tests",
          },
        },
      ],
    });

    const architect = new ArchitectAgent({ llm: mockLLM });
    const result = await architect.design({ taskId: "task-risks" });

    expect(result.status).toBe("SUCCESS");
    expect(result.plan?.risks).toHaveLength(2);
    expect(result.plan?.risks[0].severity).toBe("CRITICAL");
    expect(result.plan?.risks[1].severity).toBe("HIGH");
  });

  // 6. Plano vazio / minimal handling
  it("handles minimal requirements and injects required defaults", async () => {
    const mockLLM = createMockLLM({
      toolCalls: [
        {
          id: "call-6",
          name: "submitArchitecturePlan",
          arguments: {
            summary: "Minimal design",
            approach: "Standard modular approach",
            components: [{ name: "ModA", purpose: "General logic", responsibilities: ["Exec"] }],
            interfaces: [{ name: "IMod", description: "Interface", definition: "interface IMod {}" }],
            dependencies: [],
            risks: [],
            constraints: [],
            implementationSteps: ["Implement ModA"],
            validationStrategy: "Basic unit test",
          },
        },
      ],
    });

    const architect = new ArchitectAgent({ llm: mockLLM });
    const result = await architect.design({ taskId: "task-min" });

    expect(result.status).toBe("SUCCESS");
    expect(result.plan?.taskId).toBe("task-min");
    expect(result.plan?.createdAt).toBeDefined();
  });

  // 7. JSON Inválido
  it("fails gracefully when LLM outputs completely invalid / unparseable structure", async () => {
    const mockLLM = createMockLLM({
      content: "I cannot formulate a plan right now. Here is broken { json",
      toolCalls: [],
    });

    const architect = new ArchitectAgent({ llm: mockLLM });
    const result = await architect.design({ taskId: "task-invalid" });

    expect(result.status).toBe("FAILED");
    expect(result.error).toContain("ARCHITECT failed to generate a structured ArchitecturePlan");
    expect(architect.getState()).toBe("FAILED");
  });

  // 8. Tool calling
  it("provides ARCHITECT_TOOL_DEFINITIONS to the LLM provider", async () => {
    const mockLLM = createMockLLM({
      toolCalls: [
        {
          id: "call-8",
          name: "submitArchitecturePlan",
          arguments: {
            summary: "Test tool calling",
            approach: "Pattern",
            components: [{ name: "Comp", purpose: "Test", responsibilities: ["Test"] }],
            interfaces: [{ name: "IComp", description: "Test", definition: "interface IComp {}" }],
            dependencies: [],
            risks: [],
            constraints: [],
            implementationSteps: ["Test"],
            validationStrategy: "Test",
          },
        },
      ],
    });

    const architect = new ArchitectAgent({ llm: mockLLM });
    await architect.design({ taskId: "task-tools" });

    expect(mockLLM.generate).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        tools: ARCHITECT_TOOL_DEFINITIONS,
      })
    );
  });

  // 9. Fallback JSON
  it("extracts ArchitecturePlan from markdown code block when tools are not used", async () => {
    const fallbackJson = JSON.stringify({
      taskId: "task-fallback",
      summary: "Extracted from markdown json",
      approach: "Fallback approach",
      components: [
        {
          name: "FallbackComponent",
          purpose: "Handle fallback logic",
          responsibilities: ["Parse"],
        },
      ],
      interfaces: [
        {
          name: "IFallback",
          description: "Fallback contract",
          definition: "interface IFallback { active: boolean; }",
        },
      ],
      dependencies: [],
      risks: [],
      constraints: ["No external libraries"],
      implementationSteps: ["Step 1", "Step 2"],
      validationStrategy: "Snapshot testing",
    });

    const mockLLM = createMockLLM({
      content: `Here is the architectural blueprint:\n\`\`\`json\n${fallbackJson}\n\`\`\``,
      toolCalls: [],
    });

    const architect = new ArchitectAgent({ llm: mockLLM });
    const result = await architect.design({ taskId: "task-fallback" });

    expect(result.status).toBe("SUCCESS");
    expect(result.plan?.summary).toBe("Extracted from markdown json");
    expect(result.plan?.components[0].name).toBe("FallbackComponent");
  });

  // 10. AbortSignal
  it("handles abort signal cancellation cleanly", async () => {
    const controller = new AbortController();
    controller.abort();

    const mockLLM = createMockLLM({});
    const architect = new ArchitectAgent({ llm: mockLLM });

    const result = await architect.design({
      taskId: "task-abort",
      signal: controller.signal,
    });

    expect(result.status).toBe("CANCELLED");
    expect(result.error).toBe("EXECUTION_CANCELLED");
    expect(architect.getState()).toBe("CANCELLED");
  });

  // 11. Eventos e transições de estado
  it("emits lifecycle events and transitions states: IDLE -> ANALYZING -> DESIGNING -> ARCHITECTURE_READY", async () => {
    const stateTransitions: string[] = [];
    const events: unknown[] = [];

    const mockLLM = createMockLLM({
      toolCalls: [
        {
          id: "call-11",
          name: "submitArchitecturePlan",
          arguments: {
            summary: "Lifecycle test architecture",
            approach: "Lifecycle validation",
            components: [{ name: "LifeCycle", purpose: "Validate", responsibilities: ["Validate"] }],
            interfaces: [{ name: "ILifeCycle", description: "Interface", definition: "interface ILifeCycle {}" }],
            dependencies: [],
            risks: [],
            constraints: [],
            implementationSteps: ["Step"],
            validationStrategy: "Validation",
          },
        },
      ],
    });

    const architect = new ArchitectAgent({ llm: mockLLM });

    const result = await architect.design({
      missionId: "m-events",
      taskId: "task-events",
      onStateChange: (st) => stateTransitions.push(st),
      onEvent: (ev) => events.push(ev),
    });

    expect(result.status).toBe("SUCCESS");
    expect(stateTransitions).toContain("IDLE");
    expect(stateTransitions).toContain("ANALYZING");
    expect(stateTransitions).toContain("DESIGNING");
    expect(stateTransitions).toContain("ARCHITECTURE_READY");
    expect(events.length).toBeGreaterThanOrEqual(3);
  });
});
