# IntentVault Status

Last updated: 2026-04-06

## Phase

Initial scaffold complete. The repo now targets a local-first MVP slice with:

- one workflow: `Investigate Token (Private)`
- deterministic mock public-signal mode
- SolRouter adapter support when `SOLROUTER_API_KEY` is configured
- no wallet execution
- no database

## Completed

- Reviewed the PRD and extracted the MVP boundaries.
- Verified the repo started effectively empty apart from the PRD.
- Confirmed current Next.js setup guidance from Context7 for App Router bootstrap.
- Confirmed `@solrouter/sdk` exists on npm and exposes a documented `SolRouter(...).chat(...)` API.
- Chosen initial architecture: npm workspaces with modular packages and a single Next.js app.
- Added collaboration docs, shared schemas, provider boundaries, workflow orchestration, and the first Next.js UI shell.
- Added deterministic mock evidence and mock inference modes so the app runs without external keys.
- Added optional SolRouter inference support behind an adapter.
- Verified `npm run typecheck`, `npm run test`, and `npm run build`.

## In Progress

- Selecting the first live public data provider for post-scaffold integration.

## Next Recommended Slices

1. Replace mock public signals with a live provider once API keys and provider contracts are available.
2. Add evidence transparency UI that maps each claim to its source.
3. Add wallet-aware but still non-signing context for portfolio and token-holding analysis.
4. Add guarded execution only after explicit product approval.

## Open Questions

- Which public data provider should become the first live integration: Solana Tracker, DeFade, or another source with dependable quota and latency?
- Should the UI stay bespoke or be rebased onto the Vercel chatbot template after the domain contracts stabilize?
- What SolRouter model should be the default for structured decision cards in production?
