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

/**
 * Normalized evidence with nullable fields.
 * Fields set to null mean "unknown / not available from provider."
 */
export const normalizedEvidenceSchema = z.object({
  token: z.object({
    query: z.string(),
    mint: z.string(),
    symbol: z.string().nullable(),
    name: z.string().nullable()
  }),
  market: z.object({
    priceUsd: z.number().nonnegative().nullable(),
    liquidityUsd: z.number().nonnegative().nullable(),
    marketCapUsd: z.number().nonnegative().nullable(),
    fdvUsd: z.number().nonnegative().nullable(),
    volume5mUsd: z.number().nonnegative().nullable(),
    volume1hUsd: z.number().nonnegative().nullable(),
    volume24hUsd: z.number().nonnegative().nullable(),
    priceChange24hPct: z.number().nullable()
  }),
  holders: z.object({
    holderCount: z.number().int().nonnegative().nullable(),
    top10SharePct: z.number().min(0).max(100).nullable(),
    top20SharePct: z.number().min(0).max(100).nullable()
  }),
  authorities: z.object({
    mintAuthorityActive: z.boolean().nullable(),
    freezeAuthorityActive: z.boolean().nullable(),
    lpLockedPct: z.number().min(0).max(100).nullable()
  }),
  risk: z.object({
    score: z.number().int().min(0).max(100),
    level: riskLevelSchema,
    factors: z.array(publicRiskFactorSchema).min(1)
  }),
  discovery: z.object({
    pairAddress: z.string().nullable(),
    dexId: z.string().nullable(),
    pairUrl: z.string().nullable(),
    createdAt: z.string().nullable()
  }).optional(),
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

export const generalChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  sessionId: z.string().trim().max(120).optional().or(z.literal("")),
  model: z.string().trim().max(80).optional().or(z.literal("")),
  mode: z.enum(["chat", "research"]).optional()
});

export type GeneralChatRequest = z.infer<typeof generalChatRequestSchema>;

export const generalChatResponseSchema = z.object({
  reply: z.string(),
  runtime: z.object({
    providerName: z.string(),
    generatedAt: z.string(),
    model: z.string().optional()
  })
});

export type GeneralChatResponse = z.infer<typeof generalChatResponseSchema>;

/* ------------------------------------------------------------------ */
/* Chat message types for the session timeline UI                      */
/* ------------------------------------------------------------------ */

export const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  timestamp: z.string(),
  /** Attached workflow response for assistant messages that include a decision card */
  workflowResponse: workflowResponseSchema.optional(),
  /** Template used for this message */
  templateId: z.string().optional()
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const sessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  messages: z.array(chatMessageSchema)
});

export type Session = z.infer<typeof sessionSchema>;
