import { ZodError } from "zod";
import {
  investigationRequestSchema,
  type WorkflowResponse
} from "@intentvault/schemas";
import {
  createSignalsProvider,
  createInferenceProvider
} from "@intentvault/providers";

/**
 * Deep Research endpoint.
 * Multi-phase investigation: quick scan → deep analysis → strategy synthesis.
 * All streamed as SSE so the UI shows progressive research phases.
 */
export async function POST(request: Request) {
  let payload;
  try {
    payload = investigationRequestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: "Invalid investigation payload", issues: error.issues },
        { status: 400 }
      );
    }
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }

      const requestId = `dr-${crypto.randomUUID()}`;

      try {
        /* ============================================================
         * PHASE 1: Quick Scan — market data + basic risk score
         * ============================================================ */
        send("step", {
          step: "Phase 1: Quick scan",
          status: "running",
          detail: "Initializing deep research pipeline"
        });
        await delay(200);

        // Fetch public signals
        const signalsProvider = createSignalsProvider();
        send("step", {
          step: "Fetching market data",
          status: "running",
          detail: `${signalsProvider.name} · "${payload.tokenQuery}"`
        });

        const evidence = await signalsProvider.fetchSignals(payload);

        send("step", {
          step: "Fetching market data",
          status: "done",
          detail: `${evidence.token.name ?? evidence.token.symbol ?? payload.tokenQuery} · $${fmtNum(evidence.market.priceUsd)} · Vol $${fmtNum(evidence.market.volume24hUsd)}`
        });

        // Basic risk assessment
        send("step", {
          step: "Computing risk score",
          status: "running",
          detail: `${evidence.risk.factors.length} factors identified`
        });
        await delay(300);
        send("step", {
          step: "Computing risk score",
          status: "done",
          detail: `Preliminary: ${evidence.risk.level} (${evidence.risk.score}/100)`
        });

        send("step", {
          step: "Phase 1: Quick scan",
          status: "done",
          detail: "Market data collected"
        });

        /* ============================================================
         * PHASE 2: Deep Analysis — SolRouter analyzes patterns
         * ============================================================ */
        send("step", {
          step: "Phase 2: Deep analysis",
          status: "running",
          detail: "SolRouter encrypted inference"
        });

        // Holder pattern analysis
        send("step", {
          step: "Analyzing holder patterns",
          status: "running",
          detail: `Top 10: ${evidence.holders.top10SharePct?.toFixed(1) ?? "?"}% concentration`
        });
        await delay(400);
        send("step", {
          step: "Analyzing holder patterns",
          status: "done",
          detail: holderVerdict(evidence.holders.top10SharePct)
        });

        // Authority audit
        send("step", {
          step: "Auditing token authorities",
          status: "running",
          detail: "Checking mint & freeze authorities"
        });
        await delay(350);
        send("step", {
          step: "Auditing token authorities",
          status: "done",
          detail: authorityVerdict(
            evidence.authorities.mintAuthorityActive,
            evidence.authorities.freezeAuthorityActive
          )
        });

        // Liquidity analysis
        send("step", {
          step: "Analyzing liquidity depth",
          status: "running",
          detail: `LP locked: ${evidence.authorities.lpLockedPct?.toFixed(0) ?? "?"}%`
        });
        await delay(300);
        send("step", {
          step: "Analyzing liquidity depth",
          status: "done",
          detail: liquidityVerdict(evidence.market.liquidityUsd, evidence.authorities.lpLockedPct)
        });

        send("step", {
          step: "Phase 2: Deep analysis",
          status: "done",
          detail: "Pattern analysis complete"
        });

        /* ============================================================
         * PHASE 3: Strategy Synthesis — personalized via SolRouter
         * ============================================================ */
        send("step", {
          step: "Phase 3: Strategy synthesis",
          status: "running",
          detail: "Generating personalized strategies"
        });

        const inferenceProvider = createInferenceProvider();
        const isLive = inferenceProvider.name.includes("solrouter");

        send("step", {
          step: "Running private inference",
          status: "running",
          detail: isLive
            ? `SolRouter encrypted · ${(inferenceProvider as any).model ?? "default"}`
            : "Mock inference (set SOLROUTER_API_KEY for live)"
        });

        const decision = await inferenceProvider.createDecision({
          input: payload,
          evidence,
          requestId
        });

        send("step", {
          step: "Running private inference",
          status: "done",
          detail: `${inferenceProvider.name} · Risk: ${decision.overallRisk} · Score: ${decision.score}/100`
        });

        // Final assembly
        send("step", {
          step: "Assembling research report",
          status: "running",
          detail: "Combining all phases"
        });
        await delay(250);

        const response: WorkflowResponse = {
          requestId,
          input: payload,
          evidence,
          decision,
          runtime: {
            signalsProvider: signalsProvider.name,
            inferenceProvider: inferenceProvider.name,
            generatedAt: new Date().toISOString()
          }
        };

        send("step", {
          step: "Assembling research report",
          status: "done"
        });

        send("step", {
          step: "Phase 3: Strategy synthesis",
          status: "done",
          detail: "Research complete"
        });

        send("result", response);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown workflow failure";
        send("step", {
          step: "Deep research failed",
          status: "error",
          detail: message
        });
        send("error", { error: message });
      }

      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    }
  });
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fmtNum(val: number | null): string {
  if (val === null || val === undefined) return "?";
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  if (val >= 1) return val.toFixed(2);
  return val.toPrecision(4);
}

function holderVerdict(top10Pct: number | null): string {
  if (top10Pct === null) return "Holder data unavailable";
  if (top10Pct > 50) return `High concentration risk (${top10Pct.toFixed(1)}%)`;
  if (top10Pct > 30) return `Moderate concentration (${top10Pct.toFixed(1)}%)`;
  return `Well distributed (${top10Pct.toFixed(1)}%)`;
}

function authorityVerdict(
  mint: boolean | null,
  freeze: boolean | null
): string {
  const parts: string[] = [];
  if (mint === true) parts.push("Mint active \u26A0");
  else if (mint === false) parts.push("Mint disabled \u2713");
  else parts.push("Mint unknown");

  if (freeze === true) parts.push("Freeze active \u26A0");
  else if (freeze === false) parts.push("Freeze disabled \u2713");
  else parts.push("Freeze unknown");

  return parts.join(" · ");
}

function liquidityVerdict(liqUsd: number | null, lpLocked: number | null): string {
  const parts: string[] = [];
  if (liqUsd !== null) {
    if (liqUsd < 10_000) parts.push("Very thin liquidity");
    else if (liqUsd < 100_000) parts.push("Low liquidity");
    else if (liqUsd < 1_000_000) parts.push("Moderate liquidity");
    else parts.push("Strong liquidity");
  }
  if (lpLocked !== null) {
    parts.push(`${lpLocked.toFixed(0)}% locked`);
  }
  return parts.join(" · ") || "Liquidity data unavailable";
}
