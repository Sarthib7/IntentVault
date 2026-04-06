# IntentVault Status

Last updated: 2026-04-06

## Phase

MVP chat-based investigation product with live DexScreener data and SolRouter private inference.

## Completed

- Reviewed the PRD and extracted the MVP boundaries.
- Verified the repo started effectively empty apart from the PRD.
- Confirmed current Next.js setup guidance from Context7 for App Router bootstrap.
- Confirmed `@solrouter/sdk` exists on npm and exposes a documented `SolRouter(...).chat(...)` API.
- Chosen initial architecture: npm workspaces with modular packages and a single Next.js app.
- Added collaboration docs, shared schemas, provider boundaries, workflow orchestration, and the first Next.js UI shell.
- Added deterministic mock evidence and mock inference modes so the app runs without external keys.
- Added optional SolRouter inference support behind an adapter.
- **Added DexScreener live public signals provider** with automatic fallback to mock when API is unreachable.
- **Updated schemas for nullable fields** so live data with missing fields (holder counts, authority flags) is represented as `null` rather than faked.
- **Built chat-style UI** replacing the old form-based layout:
  - Sidebar with session list and "New Investigation" button.
  - Chat timeline with user/assistant messages.
  - Inline decision cards with tabbed strategy options.
  - Template picker dropdown (Investigate Token active; Compare Tokens and Portfolio Scan placeholders).
  - Risk mode and time horizon config dropdowns in input bar.
  - Welcome screen with template cards.
  - Thinking/loading indicator.
- **Added in-memory session store** using `useSyncExternalStore` (no localStorage dependency).
- **Added devnet context** throughout UI (network badge, input hints, provider badges).
- Verified `npm run typecheck`, `npm run test`, and `npm run build`.

## Architecture

- `INTENTVAULT_SIGNALS_MODE=auto` (default): DexScreener live → mock fallback, cached 60s.
- `INTENTVAULT_SIGNALS_MODE=mock`: mock-only mode for offline development.
- `INTENTVAULT_INFERENCE_MODE=auto` (default): SolRouter if `SOLROUTER_API_KEY` is set, otherwise mock.
- `INTENTVAULT_INFERENCE_MODE=mock`: mock inference for testing.

## In Progress

- The product is functional end-to-end with live DexScreener data.

## Next Recommended Slices

1. Add streaming responses for the chat UI (progressive rendering of decision cards).
2. Implement "Compare Tokens" template (side-by-side investigation).
3. Add wallet-aware context for portfolio analysis (read-only, no signing).
4. Add evidence transparency UI showing which claims are verified vs unknown.
5. Add Solana devnet faucet integration for demo transaction flows.
6. Add guarded execution layer (Jupiter swap simulation, user-signed only).

## Handoff Note

The product is now a working MVP with:
- Live DexScreener data fetching for any Solana token.
- Chat-based UI with session history, template selection, and inline decision cards.
- Mock fallback so the product works without network access.
- SolRouter private inference ready when API key is configured.
- All checks passing (typecheck, test, build).

To run: `npm install && npm run dev`, then visit `http://localhost:3000`.

To enable live SolRouter inference, set `SOLROUTER_API_KEY` in `.env.local`.
