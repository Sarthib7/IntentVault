# IntentVault Architecture

## Current Decision

The repo starts with a small monorepo instead of a single app directory so multiple agents can work without stepping on the same files.

## Boundaries

- `apps/web` owns presentation and HTTP route handlers.
- `packages/workflows` owns orchestration and end-to-end workflow assembly.
- `packages/providers` owns all external systems, including SolRouter.
- `packages/schemas` owns runtime-validated contracts.
- `packages/security` owns prompt shaping and redaction helpers.

## Privacy Model

- Public market facts are fetched outside the private boundary.
- User intent, notes, and constraints are shaped into a private prompt only inside the inference adapter.
- Signing keys never belong on the server.
- The current build stores no server-side chat history.

## Runtime Modes

### Public Signals

- `mock`: deterministic local evidence generation

### Inference

- `auto`: SolRouter when `SOLROUTER_API_KEY` exists, otherwise mock
- `mock`: deterministic local decision-card generation

`apps/web` loads `.env*` from the **monorepo root** first so a single root `.env.local` configures the Next server.

`GET /api/health/inference` returns whether the runtime selected SolRouter or mock (no outbound calls, no secrets).

## Immediate Follow-Up Work

1. Add a live public-signal provider with caching, timeout, and retry policy.
2. Add evidence-to-claim attribution in the UI.
3. Decide whether to keep the current UI shell or migrate onto the Vercel chatbot template after the contracts settle.

