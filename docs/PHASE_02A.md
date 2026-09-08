# LEGION // Phase 02A — Implementation Record

## Scope

Implements the Phase 02A findings from `docs/PHASE_01_AUDIT.md`: a formal `MissionEngine` contract, collision-resistant event IDs/sequencing, a mission-scoping capability on the event bus, selector-based Zustand subscriptions, an enforced mission-iteration guardrail, hardened provider contracts (Git/Deployment/LLM/Sandbox), and a Vitest test foundation covering the Event Bus, `DemoMissionEngine`, and the two reducer bugs fixed in the prior checkpoint (`02fcdcb`).

Commits: `b6599b8` (event bus / engine / guardrail), `9c86a42` (selector migration), and the provider/test commit that follows this document.

---

## npm audit — current state

Running `npm audit` after adding `vitest@^2.1.9` reports **14 vulnerabilities (6 moderate, 6 high, 2 critical)**:

| Package | Severity | Advisory summary | Fix requires |
|---|---|---|---|
| `next` (14.2.23, range 0.9.9–16.3.0-preview.10 affected) | CRITICAL | Multiple advisories: dev-server origin bypass, SSRF via Middleware/rewrites, cache poisoning, XSS, DoS via Server Components/Actions, auth bypass in Middleware, and others | `next@16.3.4` (major version jump — breaking) |
| `postcss` (bundled by `next`, ≤8.5.22) | HIGH | XSS via unescaped `</style>` output; arbitrary `.map` file disclosure via `sourceMappingURL` path traversal | `next@16.3.4` (same breaking upgrade as above — postcss here is `next`'s own bundled copy, not the project's top-level `postcss` devDependency) |
| `drizzle-orm` (0.38.3, <0.45.2 affected) | HIGH | SQL injection via improperly escaped SQL identifiers | `drizzle-orm@0.45.2` (breaking) |
| `glob` (via `@next/eslint-plugin-next` → `eslint-config-next`) | HIGH | Command injection in the `glob` CLI's `-c/--cmd` option | `eslint-config-next@16.3.4` (breaking, tied to the Next.js major upgrade) |
| `esbuild` (≤0.24.2, via two independent paths — see below) | MODERATE | Next.js/Vite dev server allows any website to send requests to it and read the response | `vitest@5.0.0` for the vitest-side path (breaking — see below) |

### The `esbuild` advisory was already present before Phase 02A

Verified with `npm ls esbuild`:

```
drizzle-kit@0.30.6
├─ @esbuild-kit/esm-loader → @esbuild-kit/core-utils → esbuild@0.18.20
├─ esbuild-register → esbuild@0.19.12 (deduped)
└─ esbuild@0.19.12
vitest@2.1.9
└─ vite@5.4.21 → esbuild@0.21.5
```

`drizzle-kit` — a devDependency since the Phase 01 checkpoint (`9eaa4e0`), untouched by this work — already pulls three vulnerable `esbuild` versions transitively. Adding `vitest` in Phase 02A introduced **one additional path** (`esbuild@0.21.5` via `vite`) into the *same* advisory class, but did not introduce a new vulnerable package family that wasn't already in the dependency tree.

## What Phase 02A did and did not introduce

- **Not introduced by Phase 02A**: the `next`, `postcss` (next's bundled copy), `drizzle-orm`, and `glob` advisories. These existed in `package-lock.json` at the Phase 01 checkpoint and are unrelated to any file touched in this phase.
- **Introduced by Phase 02A**: one additional transitive path to the pre-existing `esbuild` MODERATE advisory, via `vitest@2.1.9 → vite@5.4.21 → esbuild@0.21.5`. This is a dev-only dependency (test runner), never bundled into the Next.js application or shipped to production — it affects only the local Vite dev server that Vitest spins up internally while running `npm test`.

## Why breaking upgrades were deferred

`npm audit fix --force` would resolve every advisory above, but at the cost of:

- `next@14.2.23 → 16.3.4`: a two-major-version jump across a framework this entire application is built on (App Router internals, config shape, and React version compatibility all changed between Next 14 and 16). This is out of scope for a contract-hardening pass and carries real regression risk that needs its own dedicated, reviewed effort — not a side effect of a test-foundation task.
- `drizzle-orm@0.38.3 → 0.45.2`: a breaking change to the ORM whose schema (`src/lib/db/schema.ts`) and query patterns this project depends on directly.
- `eslint-config-next@16.3.4`: tied to the Next.js major upgrade above; cannot be taken independently.
- `vitest@2.1.9 → 5.0.0`: already attempted directly in this phase and found to conflict with the project's pinned `@types/node@^20.17.10` (vitest 5 requires `@types/node@^22 || >=24`). Resolving it would mean either forcing a broken peer resolution or upgrading `@types/node` (and by extension auditing every place `@types/node@^20`-specific typings are relied on) — again, a separate, deliberate upgrade, not a side effect of adding a test runner.

Each of these is a legitimate, separate piece of work with its own blast radius. None of them block Phase 02A's actual goal (contract hardening + test coverage), and none of them are exploitable in a way specific to what Phase 02A shipped — the CRITICAL/HIGH items are pre-existing framework/ORM/lint-tooling advisories, not defects in the code written this phase.

## Recommendation

Track the `next`/`drizzle-orm`/`eslint-config-next` upgrades as their own dedicated task before or during Phase 02B, scoped and tested independently of orchestration work — not bundled into any future feature commit. The `esbuild` dev-server advisory (moderate, dev-only, non-production) can reasonably wait for that same pass rather than being treated as urgent on its own.
