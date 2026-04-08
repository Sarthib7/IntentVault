# IntentVault Status

Last updated: 2026-04-08 (Session 4)

## Product Direction (Updated)

**Core thesis:** IntentVault is built ON TOP of SolRouter. SolRouter is the platform — not just a backend inference provider. Everything the user does flows through SolRouter's encrypted inference pipeline. DexScreener is one data source; SolRouter is the brain.

**Key principle:** We show data, we don't give financial advice. Every investigation is presented as "do your own research" — the user sees what's happening (inflows, outflows, holder patterns, authority status) and makes their own decisions. No buy/sell recommendations.

## Current State

Working MVP with:
- SolRouter encrypted inference (API key active, 5 model options)
- DexScreener live data fetching for Solana tokens
- SSE streaming with step-by-step progress
- Conversational MCQ flow (risk tolerance → time horizon → scan depth)
- Deep research API (3-phase: quick scan → deep analysis → strategy synthesis)
- Light mode default, dark mode toggle
- Model selector dropdown in input bar (GPT-OSS, Gemini Flash, Claude Sonnet, GPT-4o Mini)
- Retro terminal aesthetic with clean minimal design

## What's Done

### Backend
- **DexScreener live provider** — Real-time Solana token data, keyword search, risk scoring
- **SolRouter adapter** — Encrypted inference via `@solrouter/sdk` with Arcium RescueCipher
- **Inference health** — `GET /api/health/inference` reports solrouter vs mock (no secrets); provider runtime bootstraps root `.env.local` / `.env` so server routes see `SOLROUTER_API_KEY`
- **SSE streaming** — Both `/api/workflow/investigate-token` and `/api/workflow/deep-research`
- **Deep research pipeline** — 3 phases: market scan, holder/authority/LP analysis, strategy synthesis
- **Default chat mode** — Casual prompts use normal LLM chat, general "deep research" stays topic-oriented, and token investigation asks for the token and confirmation before the risk/depth flow
- **DexScreener matching** — Search now prefers exact base-token matches over quote-token matches, and invalid negative market-cap/FDV values are normalized instead of failing the workflow
- **Mock fallback** — Deterministic fake data when APIs are unreachable
- **Nullable schemas** — All evidence fields support null

### Frontend
- **Sidebar** — Minimal: brand, session list, theme toggle, SolRouter footer
- **Welcome screen** — SolRouter capability cards (encrypted inference, research agent, intent signals, strategy synthesis, on-chain attestation, portfolio scan)
- **Chat view** — SSE streaming with progressive workflow steps
- **MCQ flow** — After entering a token, system asks risk/horizon/depth as clickable options
- **Settings dropdown** — Model selector inside input bar with per-model pricing
- **Decision card** — Terminal aesthetic with market data, risk factors, strategies
- **CSS** — Full light/dark theme support, light mode default

## Priority For Next Agent

### 1. LIVE INVESTIGATION DASHBOARD (Highest Priority)

The decision card is a static report. Users need a **live dashboard** that shows real-time data:

**Visual components needed:**
- **Token overview header** — Name, symbol, price, 24h change (live)
- **Price chart** — Use a charting library (recharts or lightweight-charts) for price history
- **Flow visualization** — Inflows vs outflows, buy orders vs sell orders
- **Holder distribution** — Pie/donut chart showing top holder concentration
- **Authority status** — Visual indicators for mint/freeze authority, LP lock status
- **Liquidity depth** — Bar chart or visual showing available liquidity at different levels
- **Risk heatmap** — Visual risk factor severity grid
- **Transaction feed** — Recent large transactions (if available from DexScreener)

**Design principle:** Show the data, let users form their own conclusions. Add "DYOR — Not financial advice" badge prominently. No buy/sell recommendations.

**Data sources:** DexScreener API already provides most of this. May need additional endpoints for transaction history and order flow.

### 2. WALLET CONNECT (Preview)

Add a wallet connect button (initially as preview/disabled):
- Use `@solana/wallet-adapter-react` + `@solana/wallet-adapter-wallets`
- Read-only mode — no transaction signing in current phase
- Show connected wallet address in sidebar
- Future: use wallet holdings for portfolio risk scan

### 3. INTENT SIGNALS FEATURE

Show users what their query reveals vs what stays private:
- **Public signals:** Token address, market data, on-chain data — visible to DexScreener, Solana RPC
- **Private intent:** Risk tolerance, time horizon, strategy reasoning — encrypted in SolRouter TEE
- Visual split view: "What the world sees" vs "What stays encrypted"
- This is a key differentiator — make the privacy boundary tangible

### 4. ENHANCED SOLROUTER INTEGRATION

The SDK supports features we're not using yet:
- **BRAID-guided reasoning** — Agent execution DAGs for complex multi-step analysis
- **RAG collections** — Build knowledge bases from previous investigations
- **Live web search** — Encrypted web search within SolRouter
- **Session management** — Multi-turn encrypted conversations
- **Balance checking** — Show USDC balance, cost per query

### 5. ON-CHAIN ATTESTATION

SolRouter provides privacy attestation IDs. Show these to users so they can verify their intent was processed inside a TEE. Link to Solana explorer for proof.

## Architecture Reference

```
apps/web/
  app/
    api/workflow/
      investigate-token/route.ts  → Quick scan SSE endpoint
      deep-research/route.ts      → Multi-phase deep research SSE endpoint
    globals.css                   → Full theme system (light default)
    layout.tsx                    → Root layout (data-theme="light")
    page.tsx                      → Client component with theme state
  components/
    chat-view.tsx          ✅ SSE + MCQ + settings dropdown + SolRouter framing
    chat-decision-card.tsx ✅ Terminal aesthetic
    sidebar.tsx            ✅ Minimal with theme toggle

packages/
  schemas/src/index.ts     ✅ Nullable fields + chat types
  providers/src/index.ts   ✅ DexScreener + SolRouter + mock
  workflows/src/           ✅ Investigation workflow
  security/src/            ✅ Intent summarization, redaction
```

### SolRouter SDK Capabilities (Reference)

| Feature | Status | Notes |
|---------|--------|-------|
| `client.chat()` | Used | Basic encrypted inference |
| `encrypted: true` | Used | End-to-end encryption via Arcium |
| Model selection | Used | 5 models, configurable per-request |
| `client.getBalance()` | Not used | Could show USDC balance in UI |
| BRAID reasoning | Not used | Agent DAGs for complex workflows |
| RAG collections | Not used | Knowledge base from past investigations |
| Live web search | Not used | Encrypted web search integration |
| Session/conversation | Not used | Multi-turn encrypted sessions |
| Privacy attestation | Not used | On-chain proof of TEE processing |

### Environment Variables

| Var | Default | Description |
|-----|---------|-------------|
| `INTENTVAULT_SIGNALS_MODE` | `auto` | `auto` = DexScreener→mock, `mock` = mock only |
| `INTENTVAULT_INFERENCE_MODE` | `auto` | `auto` = SolRouter if key set else mock |
| `SOLROUTER_API_KEY` | — | Enables live SolRouter private inference |
| `SOLROUTER_MODEL` | `gpt-oss-20b` | Default SolRouter model |
| `SOLROUTER_BASE_URL` | — | Optional custom SolRouter endpoint |

### SolRouter Models

| Model | Cost (In/Out per 1M tokens) | Best for |
|-------|----------------------------|----------|
| `gpt-oss-20b` | $0.15 / $0.30 | Default, cheapest, structured tasks |
| `gemini-flash` | $0.08 / $0.30 | Fast, multimodal |
| `claude-sonnet` | $3.00 / $15.00 | Highest quality reasoning |
| `claude-sonnet-4` | $3.00 / $15.00 | Latest Claude |
| `gpt-4o-mini` | $0.15 / $0.60 | Balanced cost/quality |

## User Feedback (Session 3)

1. "Sidebar roadmap takes too much space" → Moved to welcome screen as feature cards
2. "Dropdowns should be inside chat input like modern AI UIs" → Settings dropdown in input bar
3. "System should ask questions (MCQ)" → Conversational flow: risk → horizon → depth
4. "SolRouter should be the main component, not DexScreener" → Full reframe around SolRouter
5. "We need research agent, intent signals, and strategy synthesis" → All three prioritized
6. "Focus on deep research" → Multi-phase deep research API built
7. "Default to light mode" → Light theme is now default
8. "Create a live dashboard, not a report" → Next priority: visual dashboard with charts
9. "Don't suggest, show data — DYOR" → No financial advice, show raw data with DYOR badge
10. "Add wallet connect" → Preview button planned
11. "Update STATUS.md and roadmap" → Done

## Git Log (Session 3)

```
aede1aa chore: default to light mode theme
64a5c12 feat: add feature icon, settings hint, model pricing in dropdown CSS
c0c9f64 feat: reframe UI around SolRouter as core platform
9a9b018 feat: add deep research API with multi-phase SSE investigation
0ba601e feat: conversational MCQ flow and settings dropdown in chat input
884567e feat: add feature grid, MCQ buttons, and settings dropdown CSS
ac32f9f refactor: slim down sidebar, remove roadmap section
988b2db feat: connect theme toggle with data-theme attribute on html
6fd47d0 feat: wire chat-view to consume SSE stream with progressive workflow steps
```

## Commands

```bash
npm install
npm run dev          # localhost:3000
npm run typecheck    # All workspaces
npm run test         # Vitest
npm run build        # Production
```

`@intentvault/web` declares `@types/react`, `@types/react-dom`, and `typescript` as devDependencies so Next.js TypeScript checks have local typings.

**Vercel:** Set the project **Root Directory** to `apps/web`. `apps/web/vercel.json` runs `npm ci` and `npm run build --workspace @intentvault/web` from the **repository root** so workspace packages (`@intentvault/schemas`, `@intentvault/workflows`) install and link. In project settings → Root Directory, enable **Include source files outside of the Root Directory** in the Build Step (so `packages/` is visible to the build).

## Git Identity

- Author: `sarthib7 <sarthiborkar7@gmail.com>`
- Do NOT push to remote
