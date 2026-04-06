# IntentVault Agent Guide

## Mission

IntentVault is a private workflow layer for Solana decision support. The current build target is the MVP workflow from the PRD: `Investigate Token (Private)`.

## Current Architecture

- `apps/web`: Next.js UI and route handlers
- `packages/schemas`: shared zod schemas and TypeScript contracts
- `packages/providers`: public-signal providers and private inference adapters
- `packages/workflows`: deterministic workflow orchestration
- `packages/security`: privacy helpers, prompt shaping, and redaction utilities
- `docs/architecture.md`: system boundaries and design notes
- `STATUS.md`: current state, active decisions, and next steps

## Hard Guardrails

- Do not add wallet signing or transaction execution in the current phase.
- Do not add database persistence or server-side storage for private user notes.
- Keep SolRouter behind an adapter. No app code outside `packages/providers` should depend on its SDK directly.
- Keep public facts and private intent separate. Public market data can be fetched normally; private user intent belongs only in the inference adapter.
- Never log secrets or raw API keys.
- Do not push to any remote.

## Collaboration Rules

- Update `STATUS.md` whenever you finish a meaningful slice or leave work in progress.
- If you change a shared contract in `packages/schemas`, update all dependents in the same change.
- Prefer adding new provider integrations beside the mock provider rather than editing the workflow contract first.
- Preserve the current package boundaries. If you need a new boundary, document the reason in `docs/architecture.md`.
- Treat the PRD as product source material, not implementation code. Keep it unchanged.

## Git Commit Identity

- All commits in this repo must use the git author identity below unless the user explicitly overrides it.
- `user.name`: `sarthib7`
- `user.email`: `sarthiborkar7@gmail.com`
- Before creating commits, verify the local git config matches those values.

## Suggested Task Ownership

- UI and interaction work: `apps/web`
- Contract changes: `packages/schemas`
- External APIs and SDKs: `packages/providers`
- Workflow logic and tests: `packages/workflows`
- Privacy and prompt shaping: `packages/security`

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm run test
npm run build
```
