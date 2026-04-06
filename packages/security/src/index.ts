import type { InvestigationRequest } from "@intentvault/schemas";

export function redactSecretValue(value: string) {
  return value.replace(/sk_[a-z0-9_]+/gi, "[redacted-key]");
}

export function summarizeIntent(input: InvestigationRequest) {
  const notes = normalizeOptionalText(input.notes);
  const walletContext = normalizeOptionalText(input.walletContext);

  return {
    riskMode: input.riskMode,
    timeHorizon: input.timeHorizon,
    walletContext: walletContext ?? "not provided",
    notes: notes ?? "no extra notes provided"
  };
}

export function normalizeOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

