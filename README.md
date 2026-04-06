# IntentVault

IntentVault is a privacy-first Solana decision workflow app. The current MVP slice implements a structured `Investigate Token (Private)` flow with a Next.js web app, shared workflow packages, deterministic mock public-signal mode, and an optional SolRouter inference adapter.

## Current Scope

- Structured token investigation form
- Typed workflow orchestration
- Shared zod contracts across UI and server
- Mock evidence generation so the app runs without external API keys
- Optional private inference through SolRouter when `SOLROUTER_API_KEY` is set

## Out of Scope Right Now

- Wallet signing
- Autonomous execution
- Database persistence
- Claims of private on-chain payments

## Project Structure

```text
apps/web                 Next.js web app
packages/schemas         Shared request and response contracts
packages/providers       Public-signal and inference adapters
packages/workflows       Workflow runner
packages/security        Prompt shaping and redaction helpers
docs/architecture.md     System and trust-boundary notes
STATUS.md                Current project state
```

## Getting Started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment

- `INTENTVAULT_SIGNALS_MODE=mock`
- `INTENTVAULT_INFERENCE_MODE=auto`
- `SOLROUTER_API_KEY=` optional
- `SOLROUTER_MODEL=gpt-oss-20b`
- `SOLROUTER_BASE_URL=` optional override

When no SolRouter key is present, the app falls back to a deterministic mock inference provider so the full workflow still runs.

## Scripts

```bash
npm run dev
npm run typecheck
npm run test
npm run build
```

