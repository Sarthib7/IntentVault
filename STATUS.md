# IntentVault Status

Last updated: 2026-04-06

## Current State

The product is a working MVP with live DexScreener data, mock inference (SolRouter adapter ready), and a chat-style UI that's mid-redesign into a retro terminal aesthetic. The UI components have been rebuilt but the chat-view.tsx still needs updating to consume the new SSE streaming API and use the new CSS classes.

## What's Done

### Backend / Data Layer (Fully Working)
- **DexScreener live provider** — Fetches real-time Solana token data via `api.dexscreener.com`. Supports address lookup + keyword search. Picks highest-volume Solana pair. Computes risk scores from liquidity, volume, volatility, pair age.
- **Mock fallback** — If DexScreener API is unreachable, mock provider generates deterministic fake data.
- **SolRouter adapter** — `SolRouterInferenceProvider` in `packages/providers/src/index.ts` is fully implemented. Uses `@solrouter/sdk` with encrypted inference. Needs `SOLROUTER_API_KEY` env var to activate.
- **SSE streaming API** — `apps/web/app/api/workflow/investigate-token/route.ts` now returns Server-Sent Events with step-by-step progress (initialize → fetch signals → normalize → private inference → assemble).
- **Nullable schemas** — All evidence fields support `null` for "unknown" so live API data with missing fields doesn't crash.

### Frontend (Partially Updated — Needs Finishing)
- **Sidebar** ✅ — Updated with roadmap section (live/soon/beta/planned badges), theme toggle, blinking cursor brand.
- **Decision card** ✅ — Redesigned with terminal aesthetic, monospace fonts, compact layout.
- **CSS** ✅ — Full retro terminal theme with dark/light mode support via `data-theme` attribute.
- **Chat view** ⚠️ **NEEDS UPDATE** — `apps/web/components/chat-view.tsx` still uses the OLD fetch (non-streaming JSON). Needs to be updated to:
  1. Consume the SSE stream from the API
  2. Show workflow steps progressively
  3. Use new CSS class names (msg-*, wf-step, etc.)
  4. Pass theme prop and wire up theme toggle
- **Page** ⚠️ **NEEDS UPDATE** — `apps/web/app/page.tsx` needs to manage theme state and pass to Sidebar.
- **Layout** ⚠️ — `apps/web/app/layout.tsx` may need `data-theme` attribute on `<html>`.

### What's NOT Working Yet
- Chat view doesn't show step-by-step progress (still instant response)
- Theme toggle is wired in sidebar but not connected to state
- The old `investigation-workspace.tsx` component is unused (can be deleted)

## Priority Order for Next Agent

### 1. FINISH THE UI (Immediate — ~30 min)

The CSS and components are built. The chat-view.tsx needs to be rewritten to:

**a) Consume SSE stream instead of JSON fetch:**
```typescript
// Instead of: const res = await fetch(url); const data = await res.json();
// Use:
const res = await fetch(url, { method: "POST", ... });
const reader = res.body!.getReader();
const decoder = new TextDecoder();
// Parse SSE events and update step state progressively
```

**b) Show workflow steps** as they come in (using the `wf-step` CSS classes):
```
[●] Initializing investigation           iv-abc123...
[●] Fetching public signals              DexScreener · "BONK"
[✓] Fetching public signals              Found Bonk · 234ms
[●] Normalizing evidence bundle          3 risk factors · Score 42/100
[●] Running private inference            SolRouter encrypted · gpt-oss-20b
[✓] Running private inference            Overall risk: medium
[✓] Assembling decision card
```

**c) Wire up theme toggle:**
- Page manages `theme` state
- Passes to Sidebar and applies `data-theme` on `<html>`

**d) Use new CSS classes:**
- Messages: `msg-indicator`, `msg-body`, `msg-meta`, `msg-sender`, `msg-time`, `msg-text`
- Steps: `wf-step`, `wf-step-icon`, `wf-step-label`, `wf-step-detail`
- Input: `input-config`, `cfg-select`, `cfg-divider`, `input-row`, `input-field`, `send-btn`

### 2. INTEGRATE SOLROUTER (Core Product Value)

This is the main product differentiator. Currently mock inference returns instant canned responses.

**To activate:**
- Set `SOLROUTER_API_KEY=your-key` in `.env.local`
- The factory function in `packages/providers/src/index.ts` → `createInferenceProvider()` will automatically use SolRouterInferenceProvider

**To test:**
- Run `npm run dev`
- Enter a token — should show "SolRouter encrypted inference" in the step detail
- Response will be slower (real AI inference) which is actually GOOD because the step-by-step visualization fills the time

**Model options** (set via `SOLROUTER_MODEL` env var):
- `gpt-oss-20b` (default)
- `gemini-flash`
- `claude-sonnet`
- `claude-sonnet-4`
- `gpt-4o-mini`

### 3. DEEP RESEARCH MODE

Once SolRouter is working, extend the investigation to multi-phase:
- Phase 1: Quick scan (market data + basic risk score)
- Phase 2: Deep analysis (SolRouter analyzes holder patterns, authority audit, LP analysis with more context)
- Phase 3: Strategy generation (personalized based on user's risk mode, time horizon, and private notes)
- Each phase is a separate SSE step so the user sees progress

### 4. UI RESEARCH DIRECTION

Research how existing AI product UIs handle similar patterns:
- **ChatGPT** — Progressive text streaming, thinking indicators, artifact panels
- **Perplexity** — Step-by-step source gathering before answer, citation cards
- **Claude** — Thinking block, artifact sidebar, clean minimal design
- **DeepSeek** — Deep think mode with reasoning chain visible
- **Vercel v0** — Code generation with preview, iteration
- **Cursor** — Agentic code changes shown step by step

Key takeaways to apply:
- Show the PROCESS not just the result (like Perplexity's source gathering)
- Use progressive disclosure (collapsed sections, expandable detail)
- Make wait time feel productive (stream partial results)
- Clear separation between "facts gathered" and "AI reasoning"
- Terminal aesthetic differentiates from generic chat UIs

### 5. REMAINING FEATURES

| Feature | Status | Notes |
|---------|--------|-------|
| Compare Tokens | Template placeholder exists | Need side-by-side layout |
| Portfolio Scan | Template placeholder exists | Need wallet adapter (read-only) |
| Wallet Connection | Not started | `@solana/wallet-adapter-react` |
| Jupiter Swap Sim | Not started | Quote-only, no signing |
| x402 Payments | Not started | Pay-per-call tool access |
| Research Artifacts | Not started | Save investigations for reference |

## Architecture Reference

```
apps/web/
  app/
    api/workflow/investigate-token/route.ts  → SSE streaming endpoint
    globals.css                              → Retro terminal theme (dark/light)
    layout.tsx                               → Root layout
    page.tsx                                 → App entry (Sidebar + ChatView)
  components/
    chat-view.tsx          ⚠️ NEEDS SSE UPDATE
    chat-decision-card.tsx ✅ Terminal aesthetic
    sidebar.tsx            ✅ With roadmap + theme toggle
    decision-card.tsx      (legacy, can delete)
    investigation-workspace.tsx (legacy, can delete)
  lib/
    session-store.ts       ✅ In-memory sessions
    use-session-store.ts   ✅ React hooks

packages/
  schemas/src/index.ts     ✅ Nullable fields + chat types
  providers/src/index.ts   ✅ DexScreener + SolRouter + mock
  workflows/src/            ✅ Investigation workflow
  security/src/             ✅ Intent summarization, redaction
```

### Environment Variables

| Var | Default | Description |
|-----|---------|-------------|
| `INTENTVAULT_SIGNALS_MODE` | `auto` | `auto` = DexScreener→mock, `mock` = mock only |
| `INTENTVAULT_INFERENCE_MODE` | `auto` | `auto` = SolRouter if key set else mock |
| `SOLROUTER_API_KEY` | — | Enables live SolRouter private inference |
| `SOLROUTER_MODEL` | `gpt-oss-20b` | SolRouter model to use |
| `SOLROUTER_BASE_URL` | — | Optional custom SolRouter endpoint |

## Git Log (Session 2)

```
e77e3fc chore: update lockfile and next env types
ef7a1ef feat: redesign decision card with terminal aesthetic
14df8b8 feat: add roadmap section and theme toggle to sidebar
33a6d94 feat: redesign UI with retro terminal aesthetic and dark/light themes
321ba13 feat: add SSE streaming for step-by-step investigation progress
a5fd5a1 docs: update status with SolRouter priority, deep research plans, and user feedback
99a7381 chore: fix gitignore pattern for tsbuildinfo files
04ecdc9 docs: update status with chat UI, live DexScreener, and devnet context
8cbbd13 feat: redesign page layout as sidebar + chat area with dark theme
954d14f feat: add chat-style UI with sidebar, timeline, and inline cards
c780ca5 feat: add in-memory session store for chat history
875a484 fix: update legacy decision card for nullable evidence fields
1fb56fc feat: add DexScreener live public signals provider with fallback
5aef9a7 feat: extend schemas with nullable fields and chat message types
```

## User Feedback (Session 2)

1. "Too fast, no steps shown" → SSE streaming endpoint built, UI needs to consume it
2. "Not going through SolRouter" → Mock is default without API key; adapter is ready
3. "UI needs work" → Full retro terminal redesign done (CSS + components), chat-view needs finishing
4. "Show roadmap features" → Sidebar now has live/soon/beta/planned roadmap
5. "Focus on SolRouter integration" → Priority 1 after UI is wired up
6. "Deep research mode" → Planned as multi-phase SolRouter investigation
7. "Research existing AI company UIs" → Reference notes added above
8. "Commit frequently" → 14 granular commits this session

## Commands

```bash
npm install
npm run dev          # localhost:3000
npm run typecheck    # All workspaces
npm run test         # Vitest
npm run build        # Production (delete .next first if EPERM)
```

## Git Identity

- Author: `sarthib7 <sarthiborkar7@gmail.com>`
- Do NOT push to remote
