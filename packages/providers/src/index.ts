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

const solRouterModels = [
  "gpt-oss-20b",
  "gemini-flash",
  "claude-sonnet",
  "claude-sonnet-4",
  "gpt-4o-mini"
] as const;

type SolRouterModel = (typeof solRouterModels)[number];

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
    const factors = buildRiskFactors({
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
        volume5mUsd: roundTo(liquidityUsd * 0.011, 2),
        volume1hUsd: roundTo(liquidityUsd * 0.09, 2),
        volume24hUsd: roundTo(liquidityUsd * 0.54, 2)
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
    const intent = summarizeIntent(input);

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
    this.#client = new SolRouter({
      apiKey,
      baseUrl,
      encrypted: true
    });
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

export function createSignalsProvider() {
  const mode = process.env.INTENTVAULT_SIGNALS_MODE ?? "mock";

  switch (mode) {
    case "mock":
    default:
      return new CachedPublicSignalsProvider(new MockPublicSignalsProvider());
  }
}

export function createInferenceProvider() {
  const mode = process.env.INTENTVAULT_INFERENCE_MODE ?? "auto";

  if (mode === "mock") {
    return new MockInferenceProvider();
  }

  const apiKey = process.env.SOLROUTER_API_KEY;

  if (!apiKey) {
    return new MockInferenceProvider();
  }

  return new SolRouterInferenceProvider({
    apiKey,
    baseUrl: process.env.SOLROUTER_BASE_URL || undefined,
    model: resolveSolRouterModel(process.env.SOLROUTER_MODEL)
  });
}

function buildRiskFactors({
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
  if (score >= 70) {
    return "high";
  }

  if (score >= 40) {
    return "medium";
  }

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
