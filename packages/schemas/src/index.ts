import { z } from "zod";

export const riskModeSchema = z.enum(["safe", "balanced", "aggressive"]);
export const timeHorizonSchema = z.enum(["short", "mid", "long"]);
export const riskLevelSchema = z.enum(["low", "medium", "high"]);

export const investigationRequestSchema = z.object({
  tokenQuery: z.string().trim().min(2).max(120),
  riskMode: riskModeSchema,
  timeHorizon: timeHorizonSchema,
  walletContext: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(600).optional().or(z.literal(""))
});

export type InvestigationRequest = z.infer<typeof investigationRequestSchema>;

export const sourceTraceSchema = z.object({
  provider: z.string(),
  latencyMs: z.number().int().nonnegative(),
  cached: z.boolean()
});

export const publicRiskFactorSchema = z.object({
  label: z.string(),
  evidence: z.string(),
  severity: riskLevelSchema
});

export const normalizedEvidenceSchema = z.object({
  token: z.object({
    query: z.string(),
    mint: z.string(),
    symbol: z.string(),
    name: z.string()
  }),
  market: z.object({
    priceUsd: z.number().nonnegative(),
    liquidityUsd: z.number().nonnegative(),
    marketCapUsd: z.number().nonnegative(),
    volume5mUsd: z.number().nonnegative(),
    volume1hUsd: z.number().nonnegative(),
    volume24hUsd: z.number().nonnegative()
  }),
  holders: z.object({
    holderCount: z.number().int().nonnegative(),
    top10SharePct: z.number().min(0).max(100),
    top20SharePct: z.number().min(0).max(100)
  }),
  authorities: z.object({
    mintAuthorityActive: z.boolean(),
    freezeAuthorityActive: z.boolean(),
    lpLockedPct: z.number().min(0).max(100)
  }),
  risk: z.object({
    score: z.number().int().min(0).max(100),
    level: riskLevelSchema,
    factors: z.array(publicRiskFactorSchema).min(1)
  }),
  sources: z.array(sourceTraceSchema).min(1)
});

export type NormalizedEvidence = z.infer<typeof normalizedEvidenceSchema>;

export const strategyOptionSchema = z.object({
  summary: z.string(),
  entryPlan: z.string(),
  exitPlan: z.string(),
  positionSizingHint: z.string()
});

export const decisionCardSchema = z.object({
  overallRisk: riskLevelSchema,
  score: z.number().int().min(0).max(100),
  topRisks: z.array(publicRiskFactorSchema).min(1),
  whatToVerifyNext: z.array(z.string()).min(2),
  strategyOptions: z.object({
    safe: strategyOptionSchema,
    balanced: strategyOptionSchema,
    aggressive: strategyOptionSchema
  }),
  disclaimer: z.string(),
  trace: z.object({
    requestId: z.string(),
    providerIds: z.array(z.string()).min(1),
    generatedAt: z.string()
  })
});

export type DecisionCard = z.infer<typeof decisionCardSchema>;

export const workflowRuntimeSchema = z.object({
  signalsProvider: z.string(),
  inferenceProvider: z.string(),
  generatedAt: z.string()
});

export const workflowResponseSchema = z.object({
  requestId: z.string(),
  input: investigationRequestSchema,
  evidence: normalizedEvidenceSchema,
  decision: decisionCardSchema,
  runtime: workflowRuntimeSchema
});

export type WorkflowResponse = z.infer<typeof workflowResponseSchema>;

