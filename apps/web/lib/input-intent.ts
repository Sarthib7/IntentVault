const INVESTIGATION_ACTIONS =
  /\b(investigate|analysis|analyze|scan|check|review|audit|buy|sell|trade|long|short)\b/i;
const TOKEN_MARKET_KEYWORDS =
  /\b(price|chart|risk|token|mint|liquidity|holder|holders|authority|fdv|pair|rug|volume|market cap)\b/i;
const GENERAL_RESEARCH_KEYWORDS = /\b(deep research|research|topic|subject)\b/i;
const CASUAL_MESSAGES = new Set(["hey", "hi", "hello", "sup", "ssup", "yo", "gm"]);

export type InputIntent =
  | { mode: "chat" }
  | { mode: "research" }
  | { mode: "need-token" }
  | { mode: "investigation"; tokenQuery: string };

export function classifyInput(value: string): InputIntent {
  const trimmed = value.trim();
  const lowered = trimmed.toLowerCase();

  if (!trimmed || CASUAL_MESSAGES.has(lowered)) {
    return { mode: "chat" };
  }

  const tokenQuery = extractTokenQuery(trimmed);
  const hasMarketKeywords = TOKEN_MARKET_KEYWORDS.test(trimmed);
  const hasInvestigationAction = INVESTIGATION_ACTIONS.test(trimmed);

  if (
    tokenQuery &&
    (
      hasMarketKeywords ||
      hasInvestigationAction ||
      /^[A-Z0-9]{2,10}$/.test(trimmed) ||
      /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)
    )
  ) {
    return { mode: "investigation", tokenQuery };
  }

  if (hasMarketKeywords || hasInvestigationAction) {
    return { mode: "need-token" };
  }

  if (GENERAL_RESEARCH_KEYWORDS.test(trimmed)) {
    return { mode: "research" };
  }

  return { mode: "chat" };
}

function extractTokenQuery(value: string): string | null {
  const trimmed = value.trim();

  const addressMatch = trimmed.match(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/);
  if (addressMatch) {
    return addressMatch[0];
  }

  if (/^[A-Z0-9]{2,10}$/.test(trimmed)) {
    return trimmed;
  }

  const symbolMatch = trimmed.match(/\$([A-Za-z][A-Za-z0-9]{1,9})\b/);
  if (symbolMatch) {
    return symbolMatch[1];
  }

  const directContextMatch = trimmed.match(
    /\b(?:buy|sell|trade|investigate|research|analyze|analysis|scan|review|audit|token|mint)\s+\$?([a-zA-Z][a-zA-Z0-9]{1,14})\b/i
  );
  if (directContextMatch) {
    return directContextMatch[1];
  }

  const priceOrChartMatch = trimmed.match(
    /\b(?:price|chart)\s+of\s+\$?([a-zA-Z][a-zA-Z0-9]{1,14})\b/i
  );
  if (priceOrChartMatch) {
    return priceOrChartMatch[1];
  }

  const tickerMatches = trimmed.match(/\b[A-Z][A-Z0-9]{1,9}\b/g);
  if (tickerMatches) {
    return tickerMatches[tickerMatches.length - 1];
  }

  return null;
}
