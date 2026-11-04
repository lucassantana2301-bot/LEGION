# LEGION — Instruções do projeto

> Complementa (não substitui) as instruções globais em `~/.claude/CLAUDE.md`.
> `AGENTS.md` (raiz) é **canônico e vinculante**: princípios, convenções de código/design e papéis dos agentes estão lá — não repito aqui. Em conflito, `AGENTS.md` vence.

## Stack (versões do `package.json`)

Next.js 14.2.23 (App Router) · React 18.3 · TypeScript 5.7 strict · Tailwind 3.4 · Zustand 5 · Drizzle ORM 0.38 + drizzle-kit 0.30 + `pg` · Zod 3.23 · Vitest 2.1 · `@e2b/code-interpreter` 2.7 · ESLint 8 (`eslint-config-next`). Gerenciador: **npm** (`package-lock.json`). Alias `@/*` → `src/*`.

## Comandos

| Ação | Comando |
|---|---|
| Dev (http://localhost:3000) | `npm run dev` |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Typecheck (sem script) | `npx tsc --noEmit` |
| Testes (Vitest, `src/**/*.test.ts`) | `npm test` — um arquivo: `npx vitest run src/lib/events/bus.test.ts` |
| Gerar migration | `npm run db:generate` (drizzle-kit, schema `src/lib/db/schema.ts` → `./drizzle`) |
| Aplicar migrations | `npm run db:migrate` — **exige aprovação humana** |

`npm run db:seed` está **quebrado**: roda `./dist/seed.js`, que não existe (só há `src/lib/db/seed-data.ts`, sem script de build). Não o use nem o cite como funcional.

## Verificação obrigatória antes de dizer "pronto"

1. `npx tsc --noEmit` → zero erros/warnings (exigência do `AGENTS.md`).
2. `npm run lint` → limpo.
3. `npm test` → todos passando; se mexeu em um módulo com `*.test.ts` ao lado, rode esse teste e atualize-o.
4. Mudou rota, layout ou config do Next → `npm run build`.
5. Mudou `schema.ts` → `npm run db:generate` e mostre o SQL gerado; **não** rode `db:migrate` sem aprovação.

Se algum passo não puder rodar (ex.: `node_modules` ausente), diga explicitamente qual não foi executado — não declare sucesso.

## Mapa do código

```
src/app/            páginas App Router + api/ (route handlers, todos POST; orchestrator/builder/diagnostic fazem streaming NDJSON)
  api/agent/orchestrator  api/agent/builder  api/sandbox/execute  api/sandbox/diagnostic
src/components/     por domínio: legion, missions, agents, graph, activity, terminal, tasks, approvals, sentinel, ui
src/lib/
  agent/            Commander, Architect, Builder, Sentinel, orchestrator, tools (writeFile/readFile/listFiles/executeSafeCommand)
  providers/        ÚNICO lugar com SDK/HTTP de terceiros: llm.ts, sandbox.ts, e2b-sandbox.ts, git.ts, deployment.ts; seleção em index.ts
  sandbox/          command-validator (allowlist de comandos) + sandbox-service
  workspace/        canonical-workspace, materializer, integrated-qa (+ testes "zero-bypass"/"hardening")
  memory/           memory-store, context-retriever, sanitizer (redação de segredos em eventos)
  events/bus.ts     legionEventBus — barramento tipado UI ⇄ engine
  engine/           demo-engine (determinístico) e mission-engine
  db/               schema.ts, index.ts (Pool pg), seed-data.ts
  config/limits.ts  limites lidos de env
  client/           mission-stream (consumo NDJSON no browser)
src/stores/         slices Zustand (mission, agents, tasks, activity, terminal) + mission-runtime-store, mission-history-store, mission-store
src/types/          domain.ts, events.ts, stream.ts — fonte de verdade dos tipos
docs/               ARCHITECTURE, EVENT_SYSTEM, DATABASE, SECURITY, ROADMAP, PRODUCT, AGENTS, PHASE_01_AUDIT, PHASE_02A/B/C
```

Não existe pasta `drizzle/` (nenhuma migration gerada ainda).

## Regras de arquitetura (resumo operacional; detalhe em `AGENTS.md` e `docs/ARCHITECTURE.md`)

- UI nunca chama engine/agentes direto: emite/assina eventos tipados em `legionEventBus`. Evento novo → declare em `src/types/events.ts` primeiro.
- SDK ou `fetch` para API externa só dentro de `src/lib/providers/`; o resto consome `getLLMProvider()` / `getSandboxProvider()` de `@/lib/providers`.
- Execução de comando só via sandbox + `src/lib/sandbox/command-validator.ts`. Nunca `child_process` no host.
- Payload externo (body de rota, saída de LLM) validado com Zod antes de usar (`docs/SECURITY.md`). Hoje as rotas em `src/app/api/` validam à mão — código novo usa Zod.
- Eventos enviados ao cliente passam por `sanitizeValue` (`src/lib/memory/sanitizer.ts`), como já fazem orchestrator e builder.
- Segredos só server-side; nada sensível em `NEXT_PUBLIC_*`, nem import de `@/lib/providers` ou `@/lib/db` em arquivo `"use client"`.
- Store nova = slice nova em `src/stores/`; não engorde uma existente.
- Aprovação humana para migrations, operações destrutivas em arquivos e deploys.
- Estado do produto: Phases 01–02C concluídas (Builder real com E2B); Phase 03 (Commander/Sentinel reais) em aberto — ver `docs/ROADMAP.md`.

## Ambiente

Copie `.env.example` → `.env.local` (o `vitest.setup.ts` carrega `.env.local` e depois `.env`). Variáveis lidas pelo código:

- Banco: `DATABASE_URL` (fallback local hardcoded em `src/lib/db/index.ts` e `drizzle.config.ts`).
- LLM: `LLM_PROVIDER` (`google`|`gemini`|`anthropic`|`openai`|`mock`), `LLM_MODEL`, `GEMINI_API_KEY`/`GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `LLM_API_KEY` (genérica).
- Sandbox: `SANDBOX_PROVIDER` (`e2b`|`real`|`mock`), `E2B_API_KEY`.
- Limites (`src/lib/config/limits.ts`): `MAX_MISSION_ITERATIONS`, `SANDBOX_TIMEOUT_MS`, `MAX_OUTPUT_BYTES`, `MAX_TERMINAL_LINES`.
- `NODE_ENV=test` libera `allowMock` na rota do orchestrator.

## Armadilhas reais

- **Seleção de LLM não cai para mock sozinha**: com `LLM_PROVIDER=google` (padrão do `.env.example`) e sem chave, `getLLMProvider()` devolve o provider Gemini, que lança `MISSING_API_KEY`. Para dev offline use `LLM_PROVIDER=mock`. Já o sandbox cai para `MockSandboxProvider` se faltar `E2B_API_KEY`.
- **Variáveis declaradas mas não lidas**: `GIT_PROVIDER`, `GITHUB_TOKEN`, `MAX_AGENT_RETRIES`, `MAX_MISSION_COST_USD`, `APPROVAL_REQUIRED_FOR_*`, `NEXT_PUBLIC_*`. Mudar o valor não muda nada até alguém implementar. `local_ollama` e `gitlab`/`github` não têm provider (só `MockGitProvider`/`MockDeploymentProvider`).
- **Orchestrator exige execução real** por padrão (`requireRealExecution`): sem chaves, a rota falha de propósito — não "conserte" removendo o guard.
- Testes `zero-bypass`/`hardening`/`audit-remediation` em `src/lib/workspace/` travam regressões de segurança; se quebrarem, o código está errado, não o teste.
- Testes que manipulam `process.env` restauram o valor original — mantenha esse padrão ao escrever novos.
- Três stores de missão coexistem (`mission-slice`, `mission-store`, `mission-runtime-store`); confira qual o componente usa antes de editar.
- `src/app/projects/[id]/files/page.tsx` contém código Drizzle **dentro de strings** (conteúdo de demo), não imports reais.
- `node_modules` pode não estar instalado; não rode `npm install` sem pedir.
