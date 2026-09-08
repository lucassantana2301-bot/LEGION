# LEGION // Phase 01 Technical Audit
## Pre-Phase 02 Architecture Review

**Checkpoint audited**: `9eaa4e0` ("chore: establish LEGION phase 01 foundation")
**Auditor role**: Lead Software Architect (AI-assisted review)
**Scope**: `src/lib/events/`, `src/lib/engine/`, `src/lib/providers/`, `src/lib/db/`, `src/stores/`, `src/types/`, `src/app/missions/`, `src/components/`, plus all root/`docs/` documentation.

---

## EXECUTIVE SUMMARY

Phase 01 delivers exactly what `docs/ROADMAP.md` claims: a strictly-typed domain model, a working typed Event Bus, a deterministic demo engine, four provider *interfaces* (mock-only), a Drizzle/PostgreSQL schema, and a full Mission Control UI wired to Zustand slices. `npx tsc --noEmit`, `npm run lint`, and `npm run build` all pass cleanly with zero errors — the foundation is functionally solid and not broken.

However, the foundation was built to *demonstrate* the product, not yet to *host* real orchestration. The audit found no CRITICAL runtime vulnerabilities (there is no shell execution, no `eval`, no `dangerouslySetInnerHTML`, and no real sandbox implementation to exploit yet), but it found several concrete, HIGH-severity **contract and architecture gaps** that will turn into real bugs or real security issues the moment Phase 02 connects live LLMs, live sandboxes, and SSE streaming. Most importantly: **the safety guardrails already documented in `.env.example` (iteration caps, cost caps, sandbox timeout, approval gates) are not read or enforced anywhere in the code** — they exist only as configuration placeholders today.

Three small, contained bugs were fixed directly during this audit (see "Safe Fixes Applied"). Everything else is documented as a finding for Phase 02A, per the no-large-refactor instruction.

---

## FOUNDATION STATUS

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ PASS — 0 errors |
| `npm run lint` | ✅ PASS — 0 warnings/errors |
| `npm run build` | ✅ PASS — 8/8 static pages, all routes compile |
| Git checkpoint | `9eaa4e0`, working tree clean prior to this audit |
| Dependencies installed | Yes, pre-existing `node_modules/` — no install performed for this audit |

---

## EVENT SYSTEM

`src/lib/events/bus.ts` is a minimal, synchronous pub/sub singleton (`Map<eventType, Set<listener>>` + a wildcard `Set`), with an in-memory ring buffer capped at 500 events.

**What works**: the `LegionEvent` discriminated union (`src/types/events.ts`) is strict and well-typed per event family (Mission/Agent/Task/File/Test/Issue/Build/Approval/Terminal); `subscribe()` returns a proper unsubscribe closure; emit is synchronous and listener errors are caught per-listener so one bad subscriber can't break the others.

**Gaps that block "backbone for Demo + Real + LLM + Sandbox + SSE + Git + Deployment" without a rewrite**:

1. **No collision-resistant event IDs.** Every emitter (30+ call sites in `demo-engine.ts`, plus `mission-slice.ts`) builds IDs as `` `evt_${Date.now()}` `` (millisecond resolution, no counter, no random component). The current demo is scripted with enough delay between emits that collisions don't surface, but a real engine emitting multiple events per tick (tool calls, streamed tokens, file diffs) **will** produce duplicate IDs. This directly undermines "duplicate delivery," "idempotency," and "replay" readiness.
2. **No sequence number.** Ordering today relies entirely on array push order and ISO timestamp strings. Two events emitted in the same millisecond are unorderable by timestamp alone, and a future persisted/replayed stream (DB-backed or SSE) has no authoritative `seq` to sort or dedupe by.
3. **No persistence.** `eventHistory` lives only in browser memory and is capped at 500 — a page refresh loses all history, and there is no DB-backed event log to replay from (see also Database section). This blocks "replay readiness" and SSE reconnection (`Last-Event-ID`) outright.
4. **No mission/workspace scoping.** `subscribe()` only takes an event *type*, never a `missionId` filter. Every subscriber receives every event for every mission. This is tolerable with one hardcoded mission; it will not scale to the multi-mission model the DB schema already assumes.
5. **Payload/consumer mismatch (found + partially fixed).** `IssueEventPayload` does not carry `stackTrace`, `affectedFile`, or `proposedFix` — fields the `Issue` domain type and the Issues page / Failure Loop Banner UI expect. The Phase 01 code plugged this gap by hardcoding the Demo's specific fake stack trace directly into the `tasks-slice` reducer (see "Safe Fixes Applied" — this has been removed, but the underlying payload gap remains and is listed under Deferred Refactoring).

---

## MISSION ENGINE

`DemoMissionEngine` (`src/lib/engine/demo-engine.ts`) exposes `start()/pause()/resume()/stop()/getStatus()` — the exact shape requested for a future shared `MissionEngine` contract — and it communicates exclusively through `legionEventBus.emit(...)`, never touching Zustand or React directly. That separation is real and is the single most important thing Phase 01 got right: **a `RealMissionEngine` implementing the same five methods and emitting the same `LegionEvent` union could be swapped in without changing a single UI component.**

Concrete gaps before that swap is safe:

1. **No formal `MissionEngine` interface/type exists yet** — only one concrete class. Nothing stops a future `RealMissionEngine` from drifting in method signature or return shape. Extracting the interface is low-risk and recommended as the first Phase 02A task.
2. **`start()` on an already-paused engine silently resumes without emitting `MISSION_RESUMED`** (`demo-engine.ts:32-37`). `mission-slice.startMission()` calls `engine.start()` unconditionally rather than checking pause state, so clicking "RUN DEMO SIMULATION" after a pause produces an inconsistent audit trail (state resumes, no resume event is logged). Documented, not auto-fixed — behavior choice (restart vs. resume) belongs to product decision.
3. **Single hardcoded mission everywhere.** `"mission-001"` is a literal default constructor argument and appears baked into `mission-slice.ts` initial state, `tasks-slice.ts` seed data, `activity-slice.ts`/`terminal-slice.ts` seed data, and route hrefs in `sidebar.tsx`/`command-palette.tsx`. There is no per-mission engine registry — only one `DemoMissionEngine` instance can meaningfully exist at a time. A `RealMissionEngine` running concurrent missions (implied by the DB's `missions` table being one-of-many) needs this addressed structurally, not cosmetically.
4. **No execution-limit enforcement inside the engine itself.** `MAX_MISSION_ITERATIONS`/`MAX_AGENT_RETRIES` are never read (confirmed via repo-wide grep — the only `process.env.*` read anywhere in `src/` is `DATABASE_URL`). The "circuit breaker" and "loop detection" responsibilities called out in `AGENTS.md` §1.4 and `docs/SECURITY.md` §5 do not exist in code yet.

---

## PROVIDER CONTRACTS

All four providers (`src/lib/providers/{llm,sandbox,git,deployment}.ts`) are clean interface + mock-implementation pairs with no vendor SDKs imported — the "no vendor lock-in" rule from `AGENTS.md` §1.3 is respected today. None are implementation-ready for real backends without contract changes:

**LLMProvider** (`llm.ts:41-49`)
- Present: `generate()`, `stream()`, tool-call types, token counts.
- Missing: no `AbortSignal`/cancellation parameter, no `timeoutMs`, no cost metadata, no `model`/`provider` fields on `LLMGenerateResult`, no structured-output (JSON mode) option. `MockLLMProvider.stream()` isn't actually incremental — it awaits the full `generate()` and fires one `onChunk` call, so the interface has never been exercised against real token-by-token streaming.

**SandboxProvider** (`sandbox.ts:23-35`)
- Present: `create/execute/readFile/writeFile/listFiles/destroy`.
- Missing: no `timeoutMs` param on `execute()` despite `.env.example`'s `SANDBOX_TIMEOUT_MS`; no resource-limit params on `create()` (CPU/memory/disk); no way to terminate a long-running `execute()` call once started (no handle/PID/cancellation token returned); no documented path-containment contract — `filePath` is an unconstrained string on `readFile`/`writeFile`, so a real implementation has no interface-level obligation to reject `../../etc/passwd`-style paths. This is the single most important contract to hardened before Phase 02B (see Security section).

**GitProvider** (`git.ts:17-24`)
- Present: `clone/branch/diff/commit/push`.
- **Missing `status()` entirely** — cannot check for a dirty worktree or current branch/HEAD before diffing or committing, which the audit brief explicitly required.

**DeploymentProvider** (`deployment.ts:11-16`)
- Present: `deploy/status/logs`.
- **Missing `cancel()` entirely** — no way to abort an in-flight deployment, also explicitly required by the audit brief.

None of these are large fixes (each is 1-2 new interface methods/params), but since they change a public contract consumed by future concrete providers, they're recommended for Phase 02A rather than silently patched here.

---

## STATE MANAGEMENT

Five Zustand slices (`mission`, `agents`, `tasks`, `activity`, `terminal`), each independently subscribing to `legionEventBus.subscribe("*", handleEvent)` and each guarding against double-subscription with a module-scoped `isSubscribed` boolean — that guard works correctly (verified: the `create()` factory callback runs once per store, so the closure is a true singleton, not per-component).

**Concrete issues found:**

1. **Unbounded terminal log array — fixed.** `terminal-slice.ts` appended every `TERMINAL_OUTPUT` event to `terminalLogs` with no cap, unlike `activity-slice.ts` which already caps at 80. For a long-running real mission this array would grow without bound, and `LegionTerminal` renders every line. **Fixed in this audit** — capped at 500 lines (matching the event bus's own history cap).
2. **No selector usage anywhere.** `useMissionStore()` (`stores/index.ts:19-41`) calls all five slice hooks with no selectors and spreads them into one object. Every component that calls it — and that is *all eleven* UI components audited, including `ApprovalModal` and `TaskDetailModal`, which are mounted globally in `app/layout.tsx` on every route — re-subscribes to the entire combined state. A single `TERMINAL_OUTPUT` event therefore re-renders the agent graph, the approval modal, the command palette data, and every other consumer, regardless of whether their slice of data changed. This is masked today by the demo's ~1.4s-per-step cadence; it will not be masked by a real LLM streaming tokens or a real sandbox streaming stdout.
3. **Cross-slice duplicated event processing.** Every one of the 5 slices independently pattern-matches on the same `LegionEvent` union and re-derives overlapping fields (`role`, `severity`, `title` string formatting) from scratch. There's no shared normalization step; changing a payload shape means touching multiple slices in lockstep with no compiler-enforced link between them beyond the shared `LegionEvent` type.
4. **Hardcoded demo data leaking into a generic reducer — fixed.** `tasks-slice.ts`'s `ISSUE_CREATED` handler previously wrote the literal demo stack trace, file path, and proposed fix into every new issue regardless of the actual event payload, because `IssueEventPayload` doesn't carry those fields. **Fixed in this audit** by populating only fields the event actually provides (`description` now derives from `event.message`); the remaining fields are simply omitted rather than fabricated. The underlying payload gap (Issue needs `stackTrace`/`affectedFile`/`proposedFix` data from somewhere) is listed under Deferred Refactoring.
5. **Approval response used the wrong approval's data — fixed.** `mission-slice.ts`'s `respondToApproval()` always emitted the hardcoded string `"Run production database migration"` and `risk: "HIGH"` regardless of *which* approval was actually being responded to. Invisible today because only one approval exists in seed data; would silently mislabel every approval decision once more than one exists. **Fixed** — the emitted event now looks up the real approval by ID and uses its own `actionTitle`/`risk`.

**Recommended bounds for Phase 02** (concrete numbers, not speculative):
- Activity events: keep the existing cap of **80** in-memory, backed by DB pagination for anything older.
- Terminal lines: **500** (now enforced) — real sandboxes can emit far more stdout than the demo; anything beyond that belongs in the DB/artifact store, not client memory.
- Mission history (event bus `eventHistory`): current cap of **500** is reasonable as a live tail buffer only if it's backed by a persisted, query-able log for anything older (see Database section) — it must not be treated as the system of record.
- Communication pulses (`activeCommunication` in `activity-slice.ts`): already a single most-recent value with a 2.4s auto-clear timer in `legion-agent-graph.tsx` — fine as-is, no change needed.

---

## DATABASE

The Drizzle schema (`src/lib/db/schema.ts`) covers all the entities in `docs/DATABASE.md` and models are broadly sound for Phase 01. Concrete gaps for **real** execution (not speculative additions):

1. **No sandbox/provider/model identifiers anywhere.** `agentRuns` (`schema.ts:132-140`) has no `sandboxId`, `provider`, or `model` column — there is no way to trace which LLM/sandbox backend produced a given run once more than one provider is live.
2. **No cost or duration tracking at the run level.** `agentRuns` has `tokensUsed` but no `costUsd` and no `durationMs` (only `startedAt`/`endedAt`, from which duration is derivable but not stored/queryable/indexable). `missions.estimatedCostUsd` (`schema.ts:113`) is a `text` column, not numeric — it cannot be summed or compared in SQL without a cast.
3. **No per-attempt history.** `tasks.attempts` (`schema.ts:151`) is a bare counter; there is no `task_attempts` table recording the outcome/duration/failure-reason of each individual attempt. Once BUILDER retries are real (not simulated), the mission will have no record of *why* attempts 1 and 2 failed before attempt 3 succeeded — directly relevant to the failure-loop the whole product is built around.
4. **No failure-reason columns.** Neither `tasks` nor `agentRuns` nor `issues`-adjacent tables have a structured `failureReason`/`errorCode` field — `issues.stackTrace` exists, but a failed `agentRun` that never produced an issue (e.g., LLM timeout, sandbox crash) has nowhere to record why.
5. **No event log table.** There is no table backing `LegionEvent` persistence — `activityEvents` is a *derived/summary* table (matches `ActivityEvent`, not the raw typed event), and it has no `seq`/ordering column beyond `timestamp`. This is the same "no persistence" gap flagged in the Event System section, seen from the DB side.
6. **Approval audit trail is role-only.** `approvals.respondedByRole`-equivalent doesn't exist — the schema only has `requestedByRole`/`respondedAt`/`responseNote`, no `respondedByUserId`. For a "human-in-the-loop" audit trail, *which agent role requested it* is tracked, but *which human* approved it is not.
7. **No explicit indexes.** Every foreign key (`missionId`, `taskId`, etc.) that will be filtered/joined on in real queries (e.g., "all activity for mission X") has no explicit index defined — Drizzle/Postgres will table-scan under real load. Not urgent at current data volumes, worth adding before Phase 02's higher event throughput.

No speculative columns are proposed — every item above corresponds to a concrete requirement stated in the audit brief (multi-run tracking, cost, duration, failure reasons, approval audit trail) that the current schema cannot satisfy.

---

## SENTINEL / TESTING GAP

Confirmed: `package.json` defines no `test` script, and no test runner (Vitest, Jest, Playwright, etc.) is a dependency. The `SENTINEL` agent's entire narrative purpose — "Executes automated test suites... validates task quality before release" — is simulated in `DemoMissionEngine` via hardcoded terminal strings (`"> npx vitest run tests/auth.test.ts"`) but no such suite exists in this repository to actually run.

Recommended structure for Phase 02A (explicitly scoped to unit + integration, no heavy E2E, per the brief):

| Priority | Target | Type | Why first |
|---|---|---|---|
| 1 | `legionEventBus` (subscribe/emit/history/wildcard/unsubscribe) | Unit | Everything else depends on its correctness; cheapest to test in isolation; directly covers today's collision/ordering findings. |
| 2 | `DemoMissionEngine` state transitions (`start/pause/resume/stop`, step sequencing) | Unit | Encodes the entire failure-loop narrative; guards against the `start()`-while-paused inconsistency found in this audit. |
| 3 | Zustand slice reducers (`tasks-slice`, `activity-slice`, `mission-slice`) given a scripted sequence of `LegionEvent`s | Unit | Catches exactly the class of bug found and fixed in this audit (hardcoded/wrong-approval data) — feed a slice a sequence of events, assert resulting state. |
| 4 | Failure loop end-to-end *within the demo engine* (TEST_FAILED → ISSUE_CREATED → ISSUE_ASSIGNED → FILE_MODIFIED → TEST_PASSED → ISSUE_RESOLVED → TASK_COMPLETED) | Integration | This sequence is the product's core value proposition; a regression here is a regression in the pitch. |
| 5 | Execution-limit guardrails (once implemented in Phase 02A per the Mission Engine section) | Unit | Test that `MAX_MISSION_ITERATIONS`/`MAX_AGENT_RETRIES` actually stop execution — currently untestable because unimplemented. |

Recommend adding **Vitest** (lightweight, fast, no config overhead vs. Next's existing tooling, distinct from any future Playwright E2E layer) as the first dependency added in Phase 02A specifically to close this gap — not added in this audit per the "no dependency installs" instruction.

---

## SECURITY

Layering per `docs/SECURITY.md`'s intended chain (Browser → LEGION Server → Orchestration → Sandbox Provider → Isolated Execution):

**No violations found in the current codebase** — there is no shell/`child_process` execution anywhere in `src/` (confirmed via repo-wide search), no `eval`/`new Function`, no `dangerouslySetInnerHTML`. `MockSandboxProvider` only touches an in-memory `Map`; nothing today crosses the browser→host boundary insecurely because nothing real executes yet.

That said, several **design-time gaps will become real vulnerabilities the moment Phase 02B implements a concrete SandboxProvider**, unless closed first:

| Severity | Finding |
|---|---|
| **HIGH** | Declared safety guardrails are unenforced. `.env.example` documents `MAX_MISSION_ITERATIONS`, `MAX_AGENT_RETRIES`, `MAX_MISSION_COST_USD`, `APPROVAL_REQUIRED_FOR_MIGRATIONS`, `APPROVAL_REQUIRED_FOR_DEPLOYS`, `SANDBOX_TIMEOUT_MS` — a repo-wide search confirms **none of these are read by any code** (`process.env.DATABASE_URL` is the only env var actually consumed in `src/`). `AGENTS.md` §1.4-1.5 and `docs/SECURITY.md` §4-5 promise exactly these controls exist. They do not yet. |
| **HIGH** | `SandboxProvider.readFile`/`writeFile` (`sandbox.ts:31-32`) take a raw `filePath: string` with no interface-level containment contract — no documented obligation for implementations to reject path traversal (`../`) or absolute paths outside the sandbox root. Must be hardened as part of the interface *before* a real implementation is written, not after. |
| **HIGH** | `SandboxProvider.execute` has no `timeoutMs` parameter and no cancellation handle — a real implementation has no interface-level way to bound execution time or kill a runaway process, despite `SANDBOX_TIMEOUT_MS` existing in config. |
| **MEDIUM** | No output-size bounding anywhere in the sandbox contract (`stdout`/`stderr` are unbounded strings) — a real long-running or misbehaving process could produce unbounded output that the event bus, terminal slice, and DB would all need to reject/truncate at some layer that doesn't exist yet. |
| **MEDIUM** | Human-in-the-loop approval is currently client-side only. `respondToApproval` mutates Zustand state and emits an event directly from the browser with no server round-trip — there is no backend/API layer yet at all (Phase 01 is Next.js App Router pages with no API routes), so "approval bypass" isn't meaningfully preventable yet. Flagged for Phase 02A: approvals must be server-authoritative once orchestration moves server-side, not just a UI gate. |
| **LOW** | Provider abstractions (`src/lib/providers/`) are correctly never imported into any `src/components/` or `src/app/` file (verified) — the "no vendor SDK in UI" rule holds today. Worth a lint rule (e.g. `no-restricted-imports`) in Phase 02A once real SDKs are added, to keep it holding under time pressure. |

No CRITICAL-severity findings exist **in the code as it stands**, because nothing in Phase 01 actually executes untrusted input yet. The HIGH items above are correctly understood as pre-conditions for Phase 02B, not bugs in Phase 01 itself.

---

## REAL-TIME READINESS (SSE)

Evaluated against the target shape `RealMissionEngine → Event Bus → server event stream → browser → Mission Control`:

- **Serialization**: `LegionEvent` members are plain JSON-serializable objects today (no functions/class instances in payloads) — safe to serialize over SSE as-is.
- **Reconnection / Last-Event-ID**: not possible today — events have no stable, collision-resistant, monotonic ID (see Event System §1) and no server-side persisted log to replay from on reconnect (see Database §5). Both must be solved before SSE reconnection can be implemented at all, not just hardened.
- **Duplicate delivery**: nothing currently de-duplicates by event ID on the consumer side (slices key React lists by `event.id`/`log.id`, which would only visually dedupe if IDs are unique — currently not guaranteed, see Event System §1).
- **Ordering**: relies on client receipt order / timestamp string comparison only; no sequence counter. An SSE stream that reconnects mid-mission has no way to know if it missed events or received them out of order.
- **Mission/workspace scoping**: the event bus has no concept of scoping subscriptions to a mission or workspace (Event System §4) — an SSE endpoint would need to filter server-side per connection, which the current bus design doesn't anticipate at all (no `missionId` parameter on `subscribe()`).
- **Authentication boundary**: there is no authentication layer anywhere in Phase 01 (no auth middleware, no session handling, no API routes at all) — this is expected for Phase 01 but is a hard prerequisite before any SSE endpoint can be exposed safely, since SSE would otherwise broadcast one workspace's mission activity to any connected client.

None of this needs implementing now — it needs the Event System and Database gaps above closed first, which is why Phase 02C (SSE) is correctly sequenced after 02A in the proposed roadmap.

---

## PERFORMANCE

Audited `Mission Control` (`app/missions/[id]/page.tsx`) and its 7 child components:

1. **Full-store re-renders on every event** (detailed in State Management §2) is the one performance finding with real teeth — everything else below is minor by comparison and would likely never have been noticed at demo event-rates.
2. `LegionTerminal`'s `useEffect` auto-scroll (`legion-terminal.tsx:13-17`) re-runs and force-scrolls on every `terminalLogs` change — correct behavior for a terminal, but will fire very frequently under real streaming stdout; consider throttling if real sandbox output arrives in a tight loop rather than the demo's discrete lines.
3. `LegionAgentGraph`'s `nodes`/`edges` objects and `LiveActivityFeed`'s `getRoleBadgeVariant`/`getSeverityIcon` closures are recreated on every render rather than hoisted to module scope — cheap today (small fixed-size objects, 4 nodes/6 edges), not worth touching until the broader re-render issue is fixed (fixing the bigger issue makes this moot).
4. SVG graph animations (`animate-ping`, `animate-flow-line`) and Framer Motion usage are CSS/GPU-driven, not JS-driven re-renders — no concern found here.
5. No virtualization on `LiveActivityFeed` (capped at 80 items) or `LegionTerminal` (now capped at 500 lines) — both bounded, so not required yet, but worth revisiting if either cap is raised later.

No micro-optimizations are recommended; the single real risk (full-store subscriptions) is architectural and belongs in Phase 02A alongside the selector/scoping work already required for multi-mission support.

---

## FINDINGS BY SEVERITY

**HIGH**
1. Execution guardrails declared in `.env.example` are entirely unenforced in code (Mission Engine / Security).
2. `SandboxProvider` contract has no path-containment obligation for `readFile`/`writeFile` (Provider Contracts / Security).
3. `SandboxProvider.execute` has no timeout/cancellation contract (Provider Contracts / Security).
4. Event IDs (`` `evt_${Date.now()}` ``) are not collision-resistant — breaks idempotency, replay, and SSE dedup (Event System).
5. No event/state persistence path — `eventHistory` and Zustand state are memory-only, blocking replay and SSE reconnection (Event System / Database / Real-Time Readiness).
6. Zero test suite despite SENTINEL's charter as quality gatekeeper (Sentinel Testing Gap).
7. Single hardcoded global mission — no per-mission/workspace scoping anywhere in stores or event bus (Mission Engine / State Management / Real-Time Readiness).
8. `useMissionStore()` has no selectors — every component re-renders on every event bus emission (State Management / Performance).

**MEDIUM**
1. `GitProvider` missing `status()`.
2. `DeploymentProvider` missing `cancel()`.
3. `LLMProvider`/`SandboxProvider` lack abort/timeout parameters at the interface level.
4. `LLMGenerateResult` lacks cost/model/provider metadata and structured-output support.
5. Drizzle schema gaps: no `sandboxId`/`provider`/`model`/`costUsd`/`durationMs` on `agentRuns`; `missions.estimatedCostUsd` stored as text; no per-attempt history table; no `respondedByUserId` on approvals; no explicit FK indexes.
6. `IssueEventPayload` doesn't carry `stackTrace`/`affectedFile`/`proposedFix` needed by the `Issue` domain type and UI.
7. Cross-slice duplicated event processing with no shared normalization layer.
8. Human approval is entirely client-side with no server-authoritative gate (no API layer exists yet).
9. No output-size bounding in the sandbox execution contract.

**LOW**
1. `DemoMissionEngine.start()` while paused silently resumes without emitting `MISSION_RESUMED`.
2. Event bus history uses `unshift`/`pop` (O(n) per emit) — bounded so harmless today.
3. No `reset()`/teardown call sites for the event bus singleton or slice timers (fine for a long-lived SPA, complicates future unit tests / dev HMR).
4. Minor unmemoized render-time object/closure recreation in `legion-agent-graph.tsx` and `live-activity-feed.tsx`.

---

## SAFE FIXES APPLIED

Per the Safe Fix Policy (§11 of the audit brief), three small, contained, non-behavioral-surprise fixes were applied directly to the working tree (not yet committed):

1. **`src/stores/terminal-slice.ts`** — capped the previously-unbounded `terminalLogs` array at 500 entries (`.slice(-MAX_TERMINAL_LINES)`), matching the event bus's own history cap. Prevents unbounded memory growth on long-running missions.
2. **`src/stores/tasks-slice.ts`** — removed hardcoded fake `stackTrace`/`affectedFile`/`proposedFix` strings from the generic `ISSUE_CREATED` reducer; `description` now derives from `event.message` instead of a literal demo string. The reducer no longer fabricates data the event payload doesn't actually contain.
3. **`src/stores/mission-slice.ts`** — `respondToApproval()` now looks up the actual `Approval` by ID and uses its real `actionTitle`/`risk` in the emitted event, instead of always emitting the hardcoded "Run production database migration" / `HIGH` regardless of which approval was answered.

All three fixes were re-verified with `npx tsc --noEmit`, `npm run lint`, and `npm run build` — all pass with no new errors or warnings. Changes are currently **unstaged** in the working tree (`git status` shows 3 modified files); no commit was made per the git safety instructions.

---

## DEFERRED REFACTORING

Documented, not implemented, per the no-large-refactor instruction:

1. Extract a formal `MissionEngine` TypeScript interface (`start/pause/resume/stop/getStatus`) that `DemoMissionEngine` implements, so `RealMissionEngine` is contractually guaranteed compatible.
2. Redesign event ID generation with a collision-resistant scheme (monotonic counter or `crypto.randomUUID()`) — touches ~30 call sites in `demo-engine.ts` plus `mission-slice.ts`.
3. Add mission/workspace scoping to `legionEventBus.subscribe()` and to every Zustand slice's initial/seed state — required before multi-mission support is possible.
4. Introduce selectors (or split `useMissionStore()` into per-need hooks) so components only re-render on the slice fields they actually consume.
5. Extend `IssueEventPayload` (and any other payload found lacking) with the fields the `Issue`/`Task` domain types actually need, then update `demo-engine.ts` emit call sites accordingly.
6. Add `status()` to `GitProvider` and `cancel()` to `DeploymentProvider`; add `AbortSignal`/`timeoutMs` to `LLMProvider` and `SandboxProvider`; add path-containment and resource-limit parameters to `SandboxProvider.create()`.
7. Extend the Drizzle schema: numeric `costUsd`/`durationMs` columns on `agentRuns` and `missions`, a `task_attempts` history table, `sandboxId`/`provider`/`model` identifiers, `respondedByUserId` on `approvals`, and explicit indexes on foreign key columns.
8. Wire the `.env.example` guardrails (`MAX_MISSION_ITERATIONS`, `MAX_AGENT_RETRIES`, `MAX_MISSION_COST_USD`, `SANDBOX_TIMEOUT_MS`, `APPROVAL_REQUIRED_FOR_*`) into actual enforcement code — currently pure configuration with no reader.
9. Introduce a persisted, ordered event log (DB-backed) so SSE reconnection with `Last-Event-ID` is possible.

---

## PHASE 02 RECOMMENDED SEQUENCE

Original proposed sequence, evaluated:

```
02A  Test foundation + execution contracts hardening
02B  Real Sandbox Provider
02C  SSE event streaming
02D  Single real agent
02E  Commander orchestration
02F  Builder + Sentinel validation loop
02G  Git integration
02H  Deployment integration
```

**This order is correct and should not change**, with one addition: fold the *event system* hardening (collision-resistant IDs, sequence numbers, mission scoping, persisted log) explicitly into **02A**, not left implicit — it is currently the largest blocker shared by 02C (SSE), 02D-02F (multi-agent event volume), and testability itself. Recommended explicit scope for 02A:

- Formal `MissionEngine` interface extraction.
- Event ID/sequence/persistence hardening (Event System findings 1-3).
- Mission/workspace scoping in the event bus and stores (finding shared across Mission Engine, State Management, Real-Time Readiness).
- Selector-based state access (State Management finding 2).
- Enforcement code for the `.env.example` guardrails (Security finding 1).
- Provider contract hardening: `SandboxProvider` timeout/path-containment/resource-limits, `GitProvider.status()`, `DeploymentProvider.cancel()`, `LLMProvider`/`SandboxProvider` cancellation (Provider Contracts findings).
- Vitest unit suite for Event Bus, `DemoMissionEngine`, and slice reducers (Sentinel Testing Gap table, priorities 1-3).

Everything from 02B onward already depends on 02A's outputs being real (a sandbox with no timeout contract, an SSE layer with no replayable event log, and an agent loop with no enforced iteration cap are each individually the kind of gap that turns into an incident once real, unpredictable LLM/sandbox behavior is in the loop). No re-ordering beyond folding event-system work explicitly into 02A is recommended.

---

## LEGION FOUNDATION STATUS: NEEDS ATTENTION

Phase 01 is not broken — it builds, type-checks, and lints clean, and its core architectural bet (UI talks only to the Event Bus, never to engines or providers directly) is sound and was verified end-to-end. "Needs attention" reflects that several HIGH findings are pre-conditions for Phase 02, not code-quality nitpicks: unenforced safety guardrails, a non-collision-resistant event ID scheme, and a single-mission-only architecture would each cause real incidents or rework if Phase 02 is built directly on top of them unaddressed.

## SAFE TO START PHASE 02A: YES

02A's proposed scope (test foundation + execution contract hardening) is precisely the set of fixes this audit identifies as prerequisites. Starting there — rather than jumping to 02B's real sandbox — directly addresses the HIGH findings before they become exploitable or untestable in production-shaped code.
