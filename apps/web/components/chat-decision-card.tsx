"use client";

import { useState } from "react";
import type { WorkflowResponse } from "@intentvault/schemas";

function fmtCurrency(val: number | null): string {
  if (val === null || val === undefined) return "Unknown";
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  if (val >= 1) return `$${val.toFixed(2)}`;
  return `$${val.toPrecision(4)}`;
}

function fmtPct(val: number | null): string {
  if (val === null || val === undefined) return "Unknown";
  return `${val > 0 ? "+" : ""}${val.toFixed(1)}%`;
}

function pctClass(val: number | null): string {
  if (val === null) return "unknown";
  return val >= 0 ? "positive" : "negative";
}

export function ChatDecisionCard({ response }: { response: WorkflowResponse }) {
  const { decision, evidence, runtime } = response;
  const [activeStrategy, setActiveStrategy] = useState<"safe" | "balanced" | "aggressive">("balanced");

  const strategies = ["safe", "balanced", "aggressive"] as const;
  const currentStrategy = decision.strategyOptions[activeStrategy];

  return (
    <div className="decision-card-wrapper">
      {/* Header */}
      <div className="dc-header">
        <div className="dc-header-left">
          <h3>Decision Card</h3>
          <div className={`risk-chip risk-${decision.overallRisk}`}>
            {decision.overallRisk} risk
          </div>
        </div>
        <div className="dc-score">
          {decision.score}<span>/100</span>
        </div>
      </div>

      <div className="dc-body">
        {/* Token info */}
        <div>
          <div className="dc-token-info">
            <span className="dc-token-name">{evidence.token.name ?? "Unknown Token"}</span>
            {evidence.token.symbol && (
              <span className="dc-token-symbol">{evidence.token.symbol}</span>
            )}
          </div>
          <div className="dc-token-mint">{evidence.token.mint}</div>
        </div>

        {/* Market metrics */}
        <div>
          <div className="dc-section-title">Market Data</div>
          <div className="dc-metrics-grid">
            <div className="dc-metric">
              <div className="dc-metric-label">Price</div>
              <div className="dc-metric-value">{fmtCurrency(evidence.market.priceUsd)}</div>
            </div>
            <div className="dc-metric">
              <div className="dc-metric-label">Liquidity</div>
              <div className="dc-metric-value">{fmtCurrency(evidence.market.liquidityUsd)}</div>
            </div>
            <div className="dc-metric">
              <div className="dc-metric-label">Market Cap</div>
              <div className="dc-metric-value">{fmtCurrency(evidence.market.marketCapUsd)}</div>
            </div>
            <div className="dc-metric">
              <div className="dc-metric-label">24h Volume</div>
              <div className="dc-metric-value">{fmtCurrency(evidence.market.volume24hUsd)}</div>
            </div>
            <div className="dc-metric">
              <div className="dc-metric-label">24h Change</div>
              <div className={`dc-metric-value ${pctClass(evidence.market.priceChange24hPct)}`}>
                {fmtPct(evidence.market.priceChange24hPct)}
              </div>
            </div>
            {evidence.market.fdvUsd !== null && evidence.market.fdvUsd !== undefined && (
              <div className="dc-metric">
                <div className="dc-metric-label">FDV</div>
                <div className="dc-metric-value">{fmtCurrency(evidence.market.fdvUsd)}</div>
              </div>
            )}
          </div>
        </div>

        {/* Risk factors */}
        <div>
          <div className="dc-section-title">Risk Factors</div>
          <div className="dc-risks">
            {decision.topRisks.map((risk, i) => (
              <div className="dc-risk-item" key={`${risk.label}-${i}`}>
                <div className={`dc-risk-severity ${risk.severity}`} />
                <div className="dc-risk-content">
                  <div className="dc-risk-label">{risk.label}</div>
                  <div className="dc-risk-evidence">{risk.evidence}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Verify next */}
        <div>
          <div className="dc-section-title">What to Verify Next</div>
          <ul className="dc-verify-list">
            {decision.whatToVerifyNext.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ul>
        </div>

        {/* Strategy options with tabs */}
        <div>
          <div className="dc-section-title">Strategy Options</div>
          <div className="dc-strategy-tabs">
            {strategies.map((s) => (
              <button
                key={s}
                className={`dc-strategy-tab ${activeStrategy === s ? "active" : ""}`}
                onClick={() => setActiveStrategy(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="dc-strategy-content">
            <p>{currentStrategy.summary}</p>
            <strong>Entry</strong>
            <p>{currentStrategy.entryPlan}</p>
            <strong>Exit</strong>
            <p>{currentStrategy.exitPlan}</p>
            <strong>Position sizing</strong>
            <p>{currentStrategy.positionSizingHint}</p>
          </div>
        </div>
      </div>

      {/* Discovery info */}
      {evidence.discovery && (
        <div className="dc-footer">
          {evidence.discovery.dexId && (
            <div className="dc-footer-item">
              <span>DEX:</span> <span>{evidence.discovery.dexId}</span>
            </div>
          )}
          {evidence.discovery.pairUrl && (
            <div className="dc-footer-item">
              <span>
                <a href={evidence.discovery.pairUrl} target="_blank" rel="noopener noreferrer">
                  View on DexScreener
                </a>
              </span>
            </div>
          )}
          {evidence.discovery.createdAt && (
            <div className="dc-footer-item">
              <span>Pair created:</span>
              <span>{new Date(evidence.discovery.createdAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      )}

      {/* Runtime trace */}
      <div className="dc-footer">
        <div className="dc-footer-item">
          <span>Signals:</span> <span>{runtime.signalsProvider}</span>
        </div>
        <div className="dc-footer-item">
          <span>Inference:</span> <span>{runtime.inferenceProvider}</span>
        </div>
        <div className="dc-footer-item">
          <span>ID:</span> <span>{response.requestId.slice(0, 12)}...</span>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="dc-disclaimer">{decision.disclaimer}</div>
    </div>
  );
}
