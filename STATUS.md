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

- Planning the next MVP slice: live public signals plus a more product-like investigation workspace.

## Next Recommended Slices

1. Replace mock public signals with a live provider that works without API keys by default.
2. Add evidence transparency UI that maps each claim to its source and shows what is unknown vs verified.
3. Add local session history so the product behaves more like an actual "vault" for repeated investigations.
4. Add wallet-aware but still non-signing context for portfolio and token-holding analysis.
5. Add guarded execution only after explicit product approval.

## Open Questions

- Which public data provider should become the first live integration: Solana Tracker, DeFade, or another source with dependable quota and latency?
- Should the UI stay bespoke or be rebased onto the Vercel chatbot template after the domain contracts stabilize?
- What SolRouter model should be the default for structured decision cards in production?

## Handoff Note

The next practical MVP slice is already identified and researched but not yet implemented:

- Use DEX Screener as the first live public-signal provider.
- Keep the current mock provider as fallback so the product remains testable without network dependency.
- Upgrade the current single-response screen into a more product-like investigation workspace with local session history and a chat-style timeline.
- Update schemas so fields not exposed by the live provider are represented as `unknown` rather than faked.

Research notes for the next agent:

- DEX Screener has current official API docs at `https://docs.dexscreener.com/api/reference`.
- Relevant endpoints confirmed:
  - `GET /latest/dex/search?q=...`
  - `GET /token-pairs/v1/{chainId}/{tokenAddress}`
- Vercel's current chat template reference found during research:
  - `vercel-labs/ai-chatbot-gateway`
- SolRouter docs URL is a JS app shell in this environment, so the npm-published `@solrouter/sdk` readme remains the clearest concrete integration reference for now.

Suggested implementation order:

1. Add a live `DexScreenerPublicSignalsProvider` with timeout and fallback to mock.
2. Extend the evidence schema for nullable or unknown fields and richer discovery metadata.
3. Refactor the front end into a session timeline with reusable sample investigations.
4. Re-run `npm run typecheck`, `npm run test`, and `npm run build`.
