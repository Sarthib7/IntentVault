"use client";

import { useState } from "react";
import type { WorkflowResponse } from "@intentvault/schemas";

function fmtCurrency(val: number | null): string {
  if (val === null || val === undefined) return "—";
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  if (val >= 1) return `$${val.toFixed(2)}`;
  return `$${val.toPrecision(4)}`;
}

function fmtPct(val: number | null): string {
  if (val === null || val === undefined) return "—";
  return `${val > 0 ? "+" : ""}${val.toFixed(1)}%`;
}

function valClass(val: number | null): string {
  if (val === null) return "na";
  return val >= 0 ? "up" : "down";
}

export function ChatDecisionCard({ response }: { response: WorkflowResponse }) {
  const { decision, evidence, runtime } = response;
  const [activeStrategy, setActiveStrategy] = useState<"safe" | "balanced" | "aggressive">("balanced");
  const strategies = ["safe", "balanced", "aggressive"] as const;
  const strat = decision.strategyOptions[activeStrategy];

  return (
    <div className="dc-wrapper">
      <div className="dc-head">
        <div className="dc-head-left">
          <h3>Decision Card</h3>
          <span className={`risk-tag ${decision.overallRisk}`}>
            {decision.overallRisk}
          </span>
        </div>
        <div className="dc-score">
          {decision.score}<span>/100</span>
        </div>
      </div>

      <div className="dc-content">
        {/* Token */}
        <div className="dc-token">
          <span className="dc-token-name">{evidence.token.name ?? "Unknown"}</span>
          {evidence.token.symbol && (
            <span className="dc-token-sym">${evidence.token.symbol}</span>
          )}
          <span className="dc-token-mint">{evidence.token.mint}</span>
        </div>

        {/* Market */}
        <div className="dc-section">
          <div className="dc-section-label">// market data</div>
          <div className="dc-metrics">
            <div className="dc-metric">
              <div className="dc-metric-lbl">Price</div>
              <div className="dc-metric-val">{fmtCurrency(evidence.market.priceUsd)}</div>
            </div>
            <div className="dc-metric">
              <div className="dc-metric-lbl">Liquidity</div>
              <div className="dc-metric-val">{fmtCurrency(evidence.market.liquidityUsd)}</div>
            </div>
            <div className="dc-metric">
              <div className="dc-metric-lbl">MCap</div>
              <div className="dc-metric-val">{fmtCurrency(evidence.market.marketCapUsd)}</div>
            </div>
            <div className="dc-metric">
              <div className="dc-metric-lbl">24h Vol</div>
              <div className="dc-metric-val">{fmtCurrency(evidence.market.volume24hUsd)}</div>
            </div>
            <div className="dc-metric">
              <div className="dc-metric-lbl">24h Chg</div>
              <div className={`dc-metric-val ${valClass(evidence.market.priceChange24hPct)}`}>
                {fmtPct(evidence.market.priceChange24hPct)}
              </div>
            </div>
            {evidence.market.fdvUsd != null && (
              <div className="dc-metric">
                <div className="dc-metric-lbl">FDV</div>
                <div className="dc-metric-val">{fmtCurrency(evidence.market.fdvUsd)}</div>
              </div>
            )}
          </div>
        </div>

        {/* Risk Factors */}
        <div className="dc-section">
          <div className="dc-section-label">// risk factors</div>
          <div className="dc-risks">
            {decision.topRisks.map((r, i) => (
              <div className="dc-risk" key={`${r.label}-${i}`}>
                <div className={`dc-risk-dot ${r.severity}`} />
                <div className="dc-risk-text">
                  <div className="dc-risk-name">{r.label}</div>
                  <div className="dc-risk-ev">{r.evidence}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Verify */}
        <div className="dc-section">
          <div className="dc-section-label">// verify next</div>
          <ul className="dc-verify">
            {decision.whatToVerifyNext.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>

        {/* Strategy */}
        <div className="dc-section">
          <div className="dc-section-label">// strategy</div>
          <div className="dc-strat-tabs">
            {strategies.map((s) => (
              <button
                key={s}
                className={`dc-strat-tab ${activeStrategy === s ? "active" : ""}`}
                onClick={() => setActiveStrategy(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="dc-strat-body">
            <p>{strat.summary}</p>
            <strong>entry</strong>
            <p>{strat.entryPlan}</p>
            <strong>exit</strong>
            <p>{strat.exitPlan}</p>
            <strong>sizing</strong>
            <p>{strat.positionSizingHint}</p>
          </div>
        </div>
      </div>

      {/* Discovery */}
      {evidence.discovery && (
        <div className="dc-foot">
          {evidence.discovery.dexId && <span>dex: {evidence.discovery.dexId}</span>}
          {evidence.discovery.pairUrl && (
            <a href={evidence.discovery.pairUrl} target="_blank" rel="noopener noreferrer">
              view on dexscreener
            </a>
          )}
          {evidence.discovery.createdAt && (
            <span>pair: {new Date(evidence.discovery.createdAt).toLocaleDateString()}</span>
          )}
        </div>
      )}

      {/* Trace */}
      <div className="dc-foot">
        <span>signals: {runtime.signalsProvider}</span>
        <span>inference: {runtime.inferenceProvider}</span>
        <span>id: {response.requestId.slice(0, 12)}</span>
      </div>

      <div className="dc-disclaimer">{decision.disclaimer}</div>
    </div>
  );
}
