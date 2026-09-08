# LEGION — Instruções do projeto

> Complementa (não substitui) as instruções globais em `~/.claude/CLAUDE.md`.
> Regras de agente adicionais e vinculantes estão em `AGENTS.md` (raiz) — leia e respeite integralmente.

## Stack

- **Framework**: Next.js 14.2.23 (App Router), React 18.3.1, TypeScript 5.7 (strict mode)
- **Estilo**: Tailwind CSS 3.4 + design tokens em CSS variables (`src/app/globals.css`)
- **Estado**: Zustand 5 (slices modulares em `src/stores/`)
- **Banco de dados**: PostgreSQL + Drizzle ORM 0.38 (`drizzle-kit` 0.30)
- **Validação**: Zod 3.23
- **Ícones/animação**: Lucide React, Framer Motion
- **Gerenciador de pacotes**: npm (há `package-lock.json`)
- **Lint**: ESLint 8 (`eslint-config-next`)

## Estrutura principal

```
src/
  app/            # Next.js App Router — páginas e layouts
  components/     # Componentes por domínio: legion, missions, agents, graph, activity, terminal, tasks, approvals, ui
  lib/
    providers/    # Abstrações de provider: llm.ts, sandbox.ts, git.ts, deployment.ts
    events/       # Event Bus tipado (bus.ts) — fonte única de verdade para telemetria/UI
    db/           # Schema Drizzle, seed, conexão
    engine/       # DemoMissionEngine (motor determinístico de demonstração)
  stores/         # Slices Zustand: mission, agents, tasks, activity, terminal
  types/          # domain.ts e events.ts — fonte de verdade dos tipos (nunca usar `any`)
docs/             # PRODUCT.md, ARCHITECTURE.md, AGENTS.md, EVENT_SYSTEM.md, DATABASE.md, SECURITY.md, ROADMAP.md
```

Ainda não existe pasta `drizzle/` (migrations) — nenhuma migration foi gerada até o momento.

## Comandos

- Instalar dependências: `npm install`
- Rodar em dev: `npm run dev` (http://localhost:3000)
- Build: `npm run build`
- Produção (após build): `npm run start`
- Lint: `npm run lint`
- Gerar migrations Drizzle: `npm run db:generate`
- Rodar migrations: `npm run db:migrate`
- Seed do banco: `npm run db:seed`
- Type check estrito (exigido pelo AGENTS.md, zero warnings): `npx tsc --noEmit`

Não há suíte de testes configurada no `package.json` no momento.

## Configuração de ambiente

- Copiar `.env.example` para `.env.local` antes de rodar localmente.
- `DATABASE_URL` aponta para PostgreSQL (`postgres://postgres:postgres@localhost:5432/legion` por padrão).
- Providers (LLM/Sandbox/Git) estão em modo `mock` por padrão — chaves reais (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GITHUB_TOKEN`) ainda não configuradas.
- Guardrails de execução já definidos via env: `MAX_MISSION_ITERATIONS`, `MAX_AGENT_RETRIES`, `MAX_MISSION_COST_USD`, `APPROVAL_REQUIRED_FOR_MIGRATIONS`, `APPROVAL_REQUIRED_FOR_DEPLOYS`.

## Arquitetura (resumo — ver `docs/ARCHITECTURE.md`)

```
UI (App Router + componentes) ──► Event Bus (legionEventBus) ◄── Zustand slices
                                        │
                       Orquestração (Commander / DemoMissionEngine)
                                        │
                Provider Abstraction Layer (LLM, Sandbox, Git, Deployment)
                                        │
                          PostgreSQL + Drizzle ORM
```

- Quatro agentes lógicos do domínio: **COMMANDER** (orquestração), **ARCHITECT** (schemas/contratos), **BUILDER** (implementação), **SENTINEL** (testes/qualidade). Ver `docs/AGENTS.md` e `AGENTS.md`.
- Fase atual do produto: **Phase 01 — Foundation + Deterministic Demo Engine** (ver `docs/ROADMAP.md`); orquestração real de LLM/sandbox ainda não implementada (Phase 02 planejada).

## Convenções específicas deste projeto

- **Nunca usar `any`** — tipos vêm de `src/types/domain.ts` e `src/types/events.ts`.
- **Nunca acoplar UI a lógica de negócio diretamente** — comunicação via eventos tipados no `legionEventBus` (`src/lib/events/bus.ts`).
- **Nunca importar SDKs de terceiros diretamente na UI ou orquestração** — usar as abstrações em `src/lib/providers/`.
- **Nunca executar comandos de shell arbitrários no host** (servidor ou browser) — toda execução de runtime deve passar por contratos de sandbox isolado.
- **Aprovação humana obrigatória** para migrations de schema, operações destrutivas em arquivos, e deploys de produção.
- Design visual: dark, minimalista, estilo dev-tool (Linear/Raycast/Vercel) — sem neon/cyberpunk. Usar classes semânticas de design tokens (`bg-surface`, `bg-surfaceRaised`, `border-border`, `text-accent`, etc.) definidas em `globals.css`.
- Estado: manter slices modulares e separados (mission, agents, tasks/issues, activity, terminal) — evitar store monolítica.
- TypeScript estrito obrigatório, sem warnings do compilador.

## Regras de segurança (ver `docs/SECURITY.md`)

1. Isolamento de host: agentes nunca executam código/shell no servidor da aplicação; workloads dinâmicos rodam em sandboxes isolados (Docker/Firecracker/E2B).
2. Zero exposição de segredos no client: API keys e credenciais de banco só em variáveis de ambiente server-side, nunca no bundle client-side.
3. Validação estrita de entrada: todo payload externo e instrução de usuário validado via Zod.
4. Human-in-the-loop obrigatório para migrations de produção, exclusão de branches e releases de produção.
5. Budgets de execução: limites de tokens, iterações máximas e detecção de loop para evitar execução recursiva descontrolada.

## Documentação importante

- `AGENTS.md` (raiz) — regras vinculantes para agentes de IA trabalhando neste repositório.
- `docs/PRODUCT.md` — visão de produto e workflows principais.
- `docs/ARCHITECTURE.md` — arquitetura do sistema e layout de diretórios.
- `docs/AGENTS.md` — papéis dos agentes (Commander/Architect/Builder/Sentinel).
- `docs/EVENT_SYSTEM.md` — especificação completa do Event Bus e hierarquia de eventos.
- `docs/DATABASE.md` — entidades do schema Drizzle/PostgreSQL.
- `docs/SECURITY.md` — princípios de segurança por design.
- `docs/ROADMAP.md` — fases do roadmap (Phase 01 atual, 02 e 03 planejadas).
