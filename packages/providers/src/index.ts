import fs from "node:fs";
import path from "node:path";
import { SolRouter } from "@solrouter/sdk";
import {
  decisionCardSchema,
  type DecisionCard,
  type InvestigationRequest,
  normalizedEvidenceSchema,
  publicRiskFactorSchema,
  type NormalizedEvidence
} from "@intentvault/schemas";
import { summarizeIntent } from "@intentvault/security";

ensureIntentVaultEnvLoaded();

/* ------------------------------------------------------------------ */
/* Provider interfaces                                                 */
/* ------------------------------------------------------------------ */

export interface PublicSignalsProvider {
  readonly name: string;
  fetchSignals(input: InvestigationRequest): Promise<NormalizedEvidence>;
}

export interface InferenceProvider {
  readonly name: string;
  createDecision(args: {
    input: InvestigationRequest;
    evidence: NormalizedEvidence;
    requestId: string;
  }): Promise<DecisionCard>;
}

export interface ChatProvider {
  readonly name: string;
  reply(args: {
    message: string;
    sessionId?: string;
    model?: string;
    mode?: "chat" | "research";
  }): Promise<{
    message: string;
    model?: string;
  }>;
}

/* ------------------------------------------------------------------ */
/* Caching wrapper                                                     */
/* ------------------------------------------------------------------ */

export class CachedPublicSignalsProvider implements PublicSignalsProvider {
  readonly name: string;
  readonly #cache = new Map<
    string,
    { value: NormalizedEvidence; expiresAt: number }
  >();

  constructor(
    private readonly inner: PublicSignalsProvider,
    private readonly ttlMs = 60_000
  ) {
    this.name = `${inner.name}:cached`;
  }

  async fetchSignals(input: InvestigationRequest) {
    const key = JSON.stringify({
      tokenQuery: input.tokenQuery.trim().toLowerCase(),
      walletContext: input.walletContext?.trim().toLowerCase() ?? ""
    });
    const cached = this.#cache.get(key);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      return normalizedEvidenceSchema.parse({
        ...cached.value,
        sources: cached.value.sources.map((source) => ({
          ...source,
          cached: true
        }))
      });
    }

    const value = await this.inner.fetchSignals(input);
    this.#cache.set(key, {
      value,
      expiresAt: now + this.ttlMs
    });
    return value;
  }
}

/* ------------------------------------------------------------------ */
/* DexScreener live provider                                           */
/* ------------------------------------------------------------------ */

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceUsd?: string;
  txns?: {
    m5?: { buys: number; sells: number };
    h1?: { buys: number; sells: number };
    h24?: { buys: number; sells: number };
  };
  volume?: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  priceChange?: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  liquidity?: {
    usd?: number;
    base?: number;
    quote?: number;
  };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
}

export class DexScreenerPublicSignalsProvider implements PublicSignalsProvider {
  readonly name = "dexscreener-live";
  private readonly baseUrl = "https://api.dexscreener.com";
  private readonly timeoutMs: number;

  constructor({ timeoutMs = 8000 }: { timeoutMs?: number } = {}) {
    this.timeoutMs = timeoutMs;
  }

  async fetchSignals(input: InvestigationRequest): Promise<NormalizedEvidence> {
    const query = input.tokenQuery.trim();
    const start = Date.now();

    // Determine if the query looks like a Solana address (base58, 32-44 chars)
    const isAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(query);

    let pair: DexScreenerPair | null = null;

    if (isAddress) {
      // Try direct token lookup first
      pair = await this.fetchByTokenAddress(query);
    }

    if (!pair) {
      // Fall back to search
      pair = await this.searchToken(query);
    }

    const latencyMs = Date.now() - start;

    if (!pair) {
      throw new Error(
        `DexScreener: no Solana pairs found for "${query}". Try a valid token mint address or symbol.`
      );
    }

    // Build risk factors from available data
    const factors = this.buildRiskFactors(pair);
    const score = this.computeRiskScore(pair, factors);
    const level = riskLevelFromScore(score);

    return normalizedEvidenceSchema.parse({
      token: {
        query,
        mint: pair.baseToken.address,
        symbol: pair.baseToken.symbol ?? null,
        name: pair.baseToken.name ?? null
      },
      market: {
        priceUsd: pair.priceUsd ? parseFloat(pair.priceUsd) : null,
        liquidityUsd: pair.liquidity?.usd ?? null,
        marketCapUsd: pair.marketCap ?? null,
        fdvUsd: pair.fdv ?? null,
        volume5mUsd: pair.volume?.m5 ?? null,
        volume1hUsd: pair.volume?.h1 ?? null,
        volume24hUsd: pair.volume?.h24 ?? null,
        priceChange24hPct: pair.priceChange?.h24 ?? null
      },
      holders: {
        holderCount: null,
        top10SharePct: null,
        top20SharePct: null
      },
      authorities: {
        mintAuthorityActive: null,
        freezeAuthorityActive: null,
        lpLockedPct: null
      },
      risk: {
        score,
        level,
        factors
      },
      discovery: {
        pairAddress: pair.pairAddress,
        dexId: pair.dexId,
        pairUrl: pair.url ?? null,
        createdAt: pair.pairCreatedAt
          ? new Date(pair.pairCreatedAt).toISOString()
          : null
      },
      sources: [
        {
          provider: this.name,
          latencyMs,
          cached: false
        }
      ]
    });
  }

  private async fetchByTokenAddress(
    address: string
  ): Promise<DexScreenerPair | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(
        `${this.baseUrl}/tokens/v1/solana/${address}`,
        { signal: controller.signal }
      );
      clearTimeout(timer);

      if (!response.ok) return null;

      const pairs: DexScreenerPair[] = await response.json();
      return this.pickBestPair(pairs);
    } catch {
      return null;
    }
  }

  private async searchToken(query: string): Promise<DexScreenerPair | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(
        `${this.baseUrl}/latest/dex/search?q=${encodeURIComponent(query)}`,
        { signal: controller.signal }
      );
      clearTimeout(timer);

      if (!response.ok) return null;

      const data = await response.json();
      const pairs: DexScreenerPair[] = data.pairs ?? [];

      // Filter to Solana pairs only
      const solanaPairs = pairs.filter(
        (p) => p.chainId === "solana"
      );

      return this.pickBestPair(solanaPairs);
    } catch {
      return null;
    }
  }

  private pickBestPair(pairs: DexScreenerPair[]): DexScreenerPair | null {
    if (!pairs || pairs.length === 0) return null;

    // Pick the pair with highest 24h volume (most active)
    return pairs.reduce((best, current) => {
      const bestVol = best.volume?.h24 ?? 0;
      const currentVol = current.volume?.h24 ?? 0;
      return currentVol > bestVol ? current : best;
    }, pairs[0]);
  }

  private buildRiskFactors(pair: DexScreenerPair) {
    const factors = [];

    // Liquidity risk
    const liqUsd = pair.liquidity?.usd ?? 0;
    factors.push(
      publicRiskFactorSchema.parse({
        label: "Liquidity depth",
        evidence:
          liqUsd > 0
            ? `Liquidity is $${formatCompact(liqUsd)} USD.`
            : "Liquidity data unavailable from this source.",
        severity: liqUsd < 10_000 ? "high" : liqUsd < 100_000 ? "medium" : "low"
      })
    );

    // Volume risk
    const vol24h = pair.volume?.h24 ?? 0;
    factors.push(
      publicRiskFactorSchema.parse({
        label: "24h trading volume",
        evidence:
          vol24h > 0
            ? `24h volume is $${formatCompact(vol24h)} USD.`
            : "Volume data unavailable.",
        severity: vol24h < 5_000 ? "high" : vol24h < 50_000 ? "medium" : "low"
      })
    );

    // Price volatility
    const change24h = pair.priceChange?.h24;
    if (change24h !== undefined && change24h !== null) {
      const absChange = Math.abs(change24h);
      factors.push(
        publicRiskFactorSchema.parse({
          label: "24h price change",
          evidence: `Price changed ${change24h > 0 ? "+" : ""}${change24h.toFixed(1)}% in 24 hours.`,
          severity: absChange > 50 ? "high" : absChange > 20 ? "medium" : "low"
        })
      );
    }

    // Pair age risk
    if (pair.pairCreatedAt) {
      const ageMs = Date.now() - pair.pairCreatedAt;
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      factors.push(
        publicRiskFactorSchema.parse({
          label: "Pair age",
          evidence: `Pair created ${ageDays < 1 ? "less than a day" : `${Math.floor(ageDays)} days`} ago.`,
          severity: ageDays < 3 ? "high" : ageDays < 30 ? "medium" : "low"
        })
      );
    }

    // FDV / market cap ratio
    if (pair.fdv && pair.marketCap && pair.marketCap > 0) {
      const ratio = pair.fdv / pair.marketCap;
      if (ratio > 5) {
        factors.push(
          publicRiskFactorSchema.parse({
            label: "FDV to market cap ratio",
            evidence: `FDV ($${formatCompact(pair.fdv)}) is ${ratio.toFixed(1)}x market cap ($${formatCompact(pair.marketCap)}), suggesting large unlocked supply.`,
            severity: ratio > 20 ? "high" : "medium"
          })
        );
      }
    }

    // Ensure at least one factor
    if (factors.length === 0) {
      factors.push(
        publicRiskFactorSchema.parse({
          label: "Limited data",
          evidence: "Insufficient data from DexScreener to assess risk factors.",
          severity: "high"
        })
      );
    }

    return factors;
  }

  private computeRiskScore(
    pair: DexScreenerPair,
    factors: { severity: string }[]
  ): number {
    let score = 50; // Start neutral

    const liqUsd = pair.liquidity?.usd ?? 0;
    if (liqUsd < 10_000) score += 20;
    else if (liqUsd < 50_000) score += 10;
    else if (liqUsd > 500_000) score -= 15;

    const vol24h = pair.volume?.h24 ?? 0;
    if (vol24h < 5_000) score += 15;
    else if (vol24h > 100_000) score -= 10;

    const change24h = pair.priceChange?.h24;
    if (change24h !== undefined && change24h !== null) {
      if (Math.abs(change24h) > 50) score += 10;
    }

    if (pair.pairCreatedAt) {
      const ageDays = (Date.now() - pair.pairCreatedAt) / (1000 * 60 * 60 * 24);
      if (ageDays < 3) score += 15;
      else if (ageDays < 7) score += 8;
    }

    // High severity factor count
    const highCount = factors.filter((f) => f.severity === "high").length;
    score += highCount * 5;

    return clamp(score, 10, 96);
  }
}

/* ------------------------------------------------------------------ */
/* Fallback provider: tries live, falls back to mock                   */
/* ------------------------------------------------------------------ */

export class FallbackPublicSignalsProvider implements PublicSignalsProvider {
  readonly name: string;

  constructor(
    private readonly primary: PublicSignalsProvider,
    private readonly fallback: PublicSignalsProvider
  ) {
    this.name = `${primary.name}|${fallback.name}`;
  }

  async fetchSignals(input: InvestigationRequest): Promise<NormalizedEvidence> {
    try {
      return await this.primary.fetchSignals(input);
    } catch {
      return await this.fallback.fetchSignals(input);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Mock provider (updated for nullable schema)                         */
/* ------------------------------------------------------------------ */

export class MockPublicSignalsProvider implements PublicSignalsProvider {
  readonly name = "mock-public-signals";

  async fetchSignals(input: InvestigationRequest) {
    const seed = hashString(input.tokenQuery.trim().toLowerCase());
    const score = clamp(22 + (seed % 64), 10, 96);
    const liquidityUsd = 45_000 + (seed % 900_000);
    const marketCapUsd = liquidityUsd * (2 + ((seed >> 3) % 10));
    const holderCount = 180 + (seed % 4_800);
    const top10SharePct = clamp(12 + ((seed >> 2) % 58), 7, 78);
    const top20SharePct = clamp(top10SharePct + 9 + ((seed >> 4) % 15), 18, 92);
    const lpLockedPct = clamp(38 + ((seed >> 5) % 61), 10, 99);
    const mintAuthorityActive = (seed & 1) === 0;
    const freezeAuthorityActive = (seed & 2) === 2;
    const symbol = input.tokenQuery.trim().slice(0, 6).toUpperCase();
    const level = riskLevelFromScore(score);
    const factors = buildMockRiskFactors({
      score,
      top10SharePct,
      lpLockedPct,
      mintAuthorityActive,
      freezeAuthorityActive
    });

    return normalizedEvidenceSchema.parse({
      token: {
        query: input.tokenQuery.trim(),
        mint: `mock-${seed.toString(16).padStart(8, "0")}`,
        symbol,
        name: `${symbol} Token`
      },
      market: {
        priceUsd: roundTo(0.0008 + (seed % 2000) / 1000, 4),
        liquidityUsd,
        marketCapUsd,
        fdvUsd: marketCapUsd * 1.5,
        volume5mUsd: roundTo(liquidityUsd * 0.011, 2),
        volume1hUsd: roundTo(liquidityUsd * 0.09, 2),
        volume24hUsd: roundTo(liquidityUsd * 0.54, 2),
        priceChange24hPct: roundTo(-12 + (seed % 60), 1)
      },
      holders: {
        holderCount,
        top10SharePct,
        top20SharePct
      },
      authorities: {
        mintAuthorityActive,
        freezeAuthorityActive,
        lpLockedPct
      },
      risk: {
        score,
        level,
        factors
      },
      sources: [
        {
          provider: this.name,
          latencyMs: 12,
          cached: false
        }
      ]
    });
  }
}

/* ------------------------------------------------------------------ */
/* Mock inference provider                                             */
/* ------------------------------------------------------------------ */

export class MockInferenceProvider implements InferenceProvider {
  readonly name = "mock-private-inference";

  async createDecision({
    input,
    evidence,
    requestId
  }: {
    input: InvestigationRequest;
    evidence: NormalizedEvidence;
    requestId: string;
  }) {
    const overallRisk = evidence.risk.level;
    const score = evidence.risk.score;
    const topRisks = evidence.risk.factors.slice(0, 3);
    const _intent = summarizeIntent(input);

    return decisionCardSchema.parse({
      overallRisk,
      score,
      topRisks,
      whatToVerifyNext: [
        "Confirm authority status against a second data source before acting.",
        "Check whether the largest holders have been rotating or simply warehousing supply.",
        "Review liquidity depth against your intended position size and slippage tolerance."
      ],
      strategyOptions: {
        safe: {
          summary: "Require stronger confirmation and smaller size before any exposure.",
          entryPlan:
            "Wait for authority and holder concentration checks to pass on a second source.",
          exitPlan:
            "Stand aside on any authority change, sharp liquidity drop, or failed support retest.",
          positionSizingHint:
            "Limit exposure to a starter position only after public signals stabilize."
        },
        balanced: {
          summary:
            "Use staged entries only if risk stays contained and liquidity supports your size.",
          entryPlan:
            "Scale in across two or three entries instead of taking a full position immediately.",
          exitPlan:
            "Reduce on weakened liquidity, deteriorating holder concentration, or invalidation of the thesis.",
          positionSizingHint:
            "Keep size moderate relative to 24h volume and your personal max drawdown."
        },
        aggressive: {
          summary:
            "Only suitable if you explicitly accept elevated volatility and asymmetric downside.",
          entryPlan:
            "Treat any entry as opportunistic and require a predefined invalidation point.",
          exitPlan:
            "Take profits into strength and cut quickly if concentration or authority risk worsens.",
          positionSizingHint:
            "Use a capped speculative sleeve rather than increasing core allocation."
        }
      },
      disclaimer:
        "This output is informational only and does not replace your own due diligence.",
      trace: {
        requestId,
        providerIds: evidence.sources.map((source) => source.provider),
        generatedAt: new Date().toISOString()
      }
    });
  }
}

export class MockChatProvider implements ChatProvider {
  readonly name = "mock-general-chat";

  async reply({
    message,
    mode = "chat"
  }: {
    message: string;
    sessionId?: string;
    model?: string;
    mode?: "chat" | "research";
  }) {
    const trimmed = message.trim();
    if (mode === "research") {
      return {
        message:
          "Tell me the topic you want researched, and I’ll treat it as a general deep-research request instead of token analysis."
      };
    }

    if (/\b(hi|hello|hey|sup|ssup|yo|gm)\b/i.test(trimmed)) {
      return {
        message:
          "Hey. I can chat normally, or run a token investigation when you ask directly. Say something like \"investigate BONK\" or \"price of BONK\" to start the workflow."
      };
    }

    return {
      message:
        "I can answer general questions here. If you want the Solana token workflow, ask explicitly for an investigation, price check, risk scan, or name a token or mint address."
    };
  }
}

/* ------------------------------------------------------------------ */
/* SolRouter inference provider                                        */
/* ------------------------------------------------------------------ */

const solRouterModels = [
  "gpt-oss-20b",
  "gemini-flash",
  "claude-sonnet",
  "claude-sonnet-4",
  "gpt-4o-mini"
] as const;

type SolRouterModel = (typeof solRouterModels)[number];

export class SolRouterInferenceProvider implements InferenceProvider {
  readonly name = "solrouter-private-inference";
  readonly #client: SolRouter;

  constructor({
    apiKey,
    baseUrl,
    model = "gpt-oss-20b"
  }: {
    apiKey: string;
    baseUrl?: string;
    model?: SolRouterModel;
  }) {
    this.#client = createSolRouterClient({ apiKey, baseUrl });
    this.model = model;
  }

  readonly model: SolRouterModel;

  async createDecision({
    input,
    evidence,
    requestId
  }: {
    input: InvestigationRequest;
    evidence: NormalizedEvidence;
    requestId: string;
  }) {
    const intent = summarizeIntent(input);
    const prompt = [
      "Return valid JSON only.",
      "Generate a decision card for a Solana token investigation workflow.",
      "Use this exact shape:",
      JSON.stringify(
        {
          overallRisk: "low | medium | high",
          score: 0,
          topRisks: [
            { label: "string", evidence: "string", severity: "low | medium | high" }
          ],
          whatToVerifyNext: ["string"],
          strategyOptions: {
            safe: {
              summary: "string",
              entryPlan: "string",
              exitPlan: "string",
              positionSizingHint: "string"
            },
            balanced: {
              summary: "string",
              entryPlan: "string",
              exitPlan: "string",
              positionSizingHint: "string"
            },
            aggressive: {
              summary: "string",
              entryPlan: "string",
              exitPlan: "string",
              positionSizingHint: "string"
            }
          },
          disclaimer: "string",
          trace: {
            requestId,
            providerIds: evidence.sources.map((source) => source.provider),
            generatedAt: new Date().toISOString()
          }
        },
        null,
        2
      ),
      "User intent and constraints:",
      JSON.stringify(intent, null, 2),
      "Normalized evidence bundle:",
      JSON.stringify(evidence, null, 2)
    ].join("\n\n");

    const response = await this.#client.chat(prompt, {
      model: this.model,
      encrypted: true,
      systemPrompt:
        "You are a cautious Solana token investigation assistant. Never emit markdown. Never mention private chain payments. Always return concise valid JSON only."
    });

    const parsed = JSON.parse(extractJsonObject(response.message));

    return decisionCardSchema.parse({
      ...parsed,
      trace: {
        requestId,
        providerIds: evidence.sources.map((source) => source.provider),
        generatedAt:
          parsed?.trace?.generatedAt && typeof parsed.trace.generatedAt === "string"
            ? parsed.trace.generatedAt
            : new Date().toISOString()
      }
    });
  }
}

export class SolRouterChatProvider implements ChatProvider {
  readonly name = "solrouter-general-chat";
  readonly #client: SolRouter;

  constructor({
    apiKey,
    baseUrl,
    model = "gpt-oss-20b"
  }: {
    apiKey: string;
    baseUrl?: string;
    model?: SolRouterModel;
  }) {
    this.#client = createSolRouterClient({ apiKey, baseUrl });
    this.model = model;
  }

  readonly model: SolRouterModel;

  async reply({
    message,
    sessionId,
    model,
    mode = "chat"
  }: {
    message: string;
    sessionId?: string;
    model?: string;
    mode?: "chat" | "research";
  }) {
    const selectedModel = resolveSolRouterModel(model);
    const response = await this.#client.chat(message, {
      model: selectedModel,
      encrypted: true,
      chatId: sessionId,
      useLiveSearch: mode === "research",
      systemPrompt:
        mode === "research"
          ? "You are IntentVault's general deep-research assistant. Research any topic, not just tokens. Use live search when useful. If the user requests deep research without naming a concrete topic, ask one brief clarifying question. Keep the response factual, concise, and well-structured. Only switch into token investigation if the user explicitly asks for token price, risk, liquidity, holders, authority, or market analysis."
          : "You are IntentVault's default assistant. Chat normally and concisely. Do not start a token investigation unless the user explicitly asks for token price, risk, liquidity, holder, authority, or market analysis."
    });

    return {
      message: response.message,
      model: selectedModel
    };
  }
}

/* ------------------------------------------------------------------ */
/* Factory functions                                                   */
/* ------------------------------------------------------------------ */

export function createSignalsProvider(): PublicSignalsProvider {
  const mode = process.env.INTENTVAULT_SIGNALS_MODE ?? "auto";

  if (mode === "mock") {
    return new CachedPublicSignalsProvider(new MockPublicSignalsProvider());
  }

  // Default "auto": try DexScreener live, fall back to mock
  const live = new DexScreenerPublicSignalsProvider();
  const mock = new MockPublicSignalsProvider();
  return new CachedPublicSignalsProvider(
    new FallbackPublicSignalsProvider(live, mock)
  );
}

export function createInferenceProvider(): InferenceProvider {
  const mode = process.env.INTENTVAULT_INFERENCE_MODE ?? "auto";

  if (mode === "mock") {
    return new MockInferenceProvider();
  }

  const apiKey = process.env.SOLROUTER_API_KEY?.trim();

  if (!apiKey) {
    return new MockInferenceProvider();
  }

  return new SolRouterInferenceProvider({
    apiKey,
    baseUrl: process.env.SOLROUTER_BASE_URL?.trim() || undefined,
    model: resolveSolRouterModel(process.env.SOLROUTER_MODEL)
  });
}

export function createChatProvider(): ChatProvider {
  const mode = process.env.INTENTVAULT_INFERENCE_MODE ?? "auto";

  if (mode === "mock") {
    return new MockChatProvider();
  }

  const apiKey = process.env.SOLROUTER_API_KEY?.trim();

  if (!apiKey) {
    return new MockChatProvider();
  }

  return new SolRouterChatProvider({
    apiKey,
    baseUrl: process.env.SOLROUTER_BASE_URL?.trim() || undefined,
    model: resolveSolRouterModel(process.env.SOLROUTER_MODEL)
  });
}

export type InferenceRuntimeInfo = {
  backend: "solrouter" | "mock";
  providerName: string;
  model?: string;
  note?: string;
};

/** Safe summary for health checks — no secrets. */
export function getInferenceRuntimeInfo(): InferenceRuntimeInfo {
  const explicitMock =
    (process.env.INTENTVAULT_INFERENCE_MODE ?? "auto") === "mock";
  const hasKey = Boolean(process.env.SOLROUTER_API_KEY?.trim());
  const provider = createInferenceProvider();
  const usingSolrouter = provider.name.includes("solrouter");
  let note: string | undefined;
  if (!usingSolrouter) {
    if (explicitMock) note = "INTENTVAULT_INFERENCE_MODE=mock";
    else if (!hasKey) note = "SOLROUTER_API_KEY missing or empty";
  }
  const model =
    usingSolrouter && "model" in provider
      ? (provider as { model: string }).model
      : undefined;
  return {
    backend: usingSolrouter ? "solrouter" : "mock",
    providerName: provider.name,
    model,
    note
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function buildMockRiskFactors({
  score,
  top10SharePct,
  lpLockedPct,
  mintAuthorityActive,
  freezeAuthorityActive
}: {
  score: number;
  top10SharePct: number;
  lpLockedPct: number;
  mintAuthorityActive: boolean;
  freezeAuthorityActive: boolean;
}) {
  const factors = [
    publicRiskFactorSchema.parse({
      label: "Holder concentration",
      evidence: `Top 10 holders control ${top10SharePct.toFixed(1)}% of supply.`,
      severity: top10SharePct > 45 ? "high" : top10SharePct > 28 ? "medium" : "low"
    }),
    publicRiskFactorSchema.parse({
      label: "Liquidity lock",
      evidence: `${lpLockedPct.toFixed(1)}% of liquidity appears locked.`,
      severity: lpLockedPct < 50 ? "high" : lpLockedPct < 75 ? "medium" : "low"
    }),
    publicRiskFactorSchema.parse({
      label: "Mint authority",
      evidence: mintAuthorityActive
        ? "Mint authority is still active."
        : "Mint authority appears disabled.",
      severity: mintAuthorityActive ? "high" : "low"
    })
  ];

  if (freezeAuthorityActive) {
    factors.push(
      publicRiskFactorSchema.parse({
        label: "Freeze authority",
        evidence: "Freeze authority is still active.",
        severity: score > 65 ? "high" : "medium"
      })
    );
  }

  return factors;
}

function riskLevelFromScore(score: number) {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function hashString(value: string) {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

function extractJsonObject(value: string) {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("SolRouter response did not contain a JSON object");
  }
  return value.slice(start, end + 1);
}

function resolveSolRouterModel(value: string | undefined): SolRouterModel {
  if (value && solRouterModels.includes(value as SolRouterModel)) {
    return value as SolRouterModel;
  }
  return "gpt-oss-20b";
}

function createSolRouterClient({
  apiKey,
  baseUrl
}: {
  apiKey: string;
  baseUrl?: string;
}) {
  return new SolRouter({
    apiKey,
    baseUrl: normalizeSolRouterBaseUrl(baseUrl),
    encrypted: true
  });
}

function normalizeSolRouterBaseUrl(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return value
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/tee\/process$/, "")
    .replace(/\/api\/v1\/balance$/, "")
    .replace(/\/(?:agent|router|nosana|gemini|claude|openai)$/, "");
}

function ensureIntentVaultEnvLoaded() {
  if (process.env.__INTENTVAULT_ENV_LOADED === "1") {
    return;
  }

  for (const directory of candidateEnvDirectories(process.cwd())) {
    loadEnvFile(path.join(directory, ".env.local"));
    loadEnvFile(path.join(directory, ".env"));
  }

  process.env.__INTENTVAULT_ENV_LOADED = "1";
}

function candidateEnvDirectories(start: string) {
  const directories: string[] = [];
  let current = path.resolve(start);

  for (let depth = 0; depth < 4; depth += 1) {
    directories.push(current);
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return directories;
}

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = trimmed.slice(equalsIndex + 1).trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}
