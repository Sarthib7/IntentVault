# IntentVault Status

Last updated: 2026-04-06

## Current Focus (Active Work)

**Priority 1: SolRouter Integration (Core Product)**
The main product value is private inference via SolRouter. The current build has mock inference as default and SolRouter ready behind an adapter. The IMMEDIATE next step is to make SolRouter the primary inference engine so investigations actually go through private encrypted inference rather than returning instant mock responses.

- SolRouter SDK is installed (`@solrouter/sdk`)
- Adapter exists in `packages/providers/src/index.ts` → `SolRouterInferenceProvider`
- Needs `SOLROUTER_API_KEY` env var to activate
- Default model: `gpt-oss-20b` (configurable via `SOLROUTER_MODEL`)
- Integration point: `createInferenceProvider()` factory function

**Priority 2: Deep Research Mode**
Build a "deep research" mode where SolRouter does actual multi-step research:
- Collect public signals (DexScreener live data) ✅ Done
- Run private inference through SolRouter with structured prompts ← Next
- Generate research artifacts (detailed analysis, risk breakdowns)
- Show step-by-step progress as investigation runs (streaming SSE) ← In progress

**Priority 3: UI Overhaul (In Progress)**
Redesigning from basic form to retro terminal-aesthetic chat interface:
- Dark/light theme toggle
- Monospace-driven clean minimal design
- Step-by-step workflow visualization (not instant answers)
- Roadmap features with Soon/Closed Beta labels
- Better provider transparency (mock vs live indicators)

## Completed

- PRD review and MVP boundary extraction
- npm workspace architecture with modular packages
- Mock public signals and mock inference providers
- SolRouter adapter (ready, needs API key to activate)
- DexScreener live public signals provider with fallback to mock
- Schemas updated for nullable fields (live API compatibility)
- Chat-style UI with session timeline, sidebar, inline decision cards
- In-memory session store (no localStorage, no server persistence)
- Streaming SSE API endpoint for step-by-step investigation progress
- Test, typecheck, and build all passing

## Architecture

```
apps/web/                    → Next.js App Router UI
  app/api/workflow/          → SSE streaming investigation endpoint
  components/                → Chat UI, decision cards, sidebar
  lib/                       → Session store, hooks

packages/schemas/            → Zod schemas, TypeScript contracts
packages/providers/          → DexScreener live, SolRouter adapter, mock providers
packages/workflows/          → Deterministic workflow orchestration
packages/security/           → Prompt shaping, intent summarization, redaction
```

### Provider Modes

| Env Var | Value | Behavior |
|---------|-------|----------|
| `INTENTVAULT_SIGNALS_MODE` | `auto` (default) | DexScreener live → mock fallback |
| `INTENTVAULT_SIGNALS_MODE` | `mock` | Mock only (offline dev) |
| `INTENTVAULT_INFERENCE_MODE` | `auto` (default) | SolRouter if API key set, else mock |
| `INTENTVAULT_INFERENCE_MODE` | `mock` | Mock inference only |
| `SOLROUTER_API_KEY` | (your key) | Enables live SolRouter private inference |
| `SOLROUTER_MODEL` | `gpt-oss-20b` etc | SolRouter model selection |

## In Progress

- UI overhaul: retro terminal aesthetic with dark/light themes
- Streaming workflow steps (SSE endpoint done, UI consuming it in progress)
- SolRouter as primary inference (adapter ready, needs API key for testing)

## Next Steps for Next Agent

1. **Test with real SolRouter API key** — Set `SOLROUTER_API_KEY` in `.env.local` and verify the full flow works end-to-end with encrypted private inference.
2. **Deep Research Mode** — Extend the SolRouter prompt to do multi-step analysis:
   - Phase 1: Quick scan (risk score, basic market data)
   - Phase 2: Deep analysis (holder patterns, authority audit, LP analysis)
   - Phase 3: Strategy generation (personalized based on user intent)
   - Each phase streams back to the UI as a separate step
3. **Research Artifacts** — Save investigation results as structured artifacts that users can reference later.
4. **Compare Tokens template** — Side-by-side investigation of two tokens.
5. **Portfolio Scan template** — Wallet-aware risk analysis (read-only).
6. **Wallet adapter** — Solana Wallet Adapter for portfolio context (no signing).

## Roadmap Features (for UI display)

| Feature | Status | Label |
|---------|--------|-------|
| Investigate Token | Active | LIVE |
| DexScreener Live Data | Active | LIVE |
| SolRouter Private Inference | Ready (needs API key) | LIVE |
| Step-by-Step Progress | In progress | SOON |
| Deep Research Mode | Planned | SOON |
| Compare Tokens | Planned | CLOSED BETA |
| Portfolio Risk Scan | Planned | CLOSED BETA |
| Wallet Connection | Planned | CLOSED BETA |
| Jupiter Swap Simulation | Planned | FUTURE |
| x402 Pay-per-call Tools | Planned | FUTURE |

## User Feedback (Session 2)

- "Too fast, no steps shown" → Adding SSE streaming with step-by-step progress
- "Not going through SolRouter" → Mock inference active by default; need API key for live
- "UI needs work" → Full redesign with retro terminal aesthetic, dark/light themes
- "Show roadmap features" → Adding Soon/Closed Beta labels in sidebar
- "Focus on SolRouter integration" → Priority 1 for next work
- "Deep research mode" → Using SolRouter for multi-step private research

## Commands

```bash
npm install
npm run dev          # Start dev server at localhost:3000
npm run typecheck    # Type check all workspaces
npm run test         # Run vitest
npm run build        # Production build
```

## Git Identity

- Author: `sarthib7 <sarthiborkar7@gmail.com>`
- Do NOT push to remote
