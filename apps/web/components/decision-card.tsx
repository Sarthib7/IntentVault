import type { WorkflowResponse } from "@intentvault/schemas";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function DecisionCard({
  response
}: {
  response: WorkflowResponse;
}) {
  const { decision, evidence, runtime } = response;

  return (
    <>
      <section className="result-card">
        <h3>Decision Card</h3>
        <div className={`risk-chip risk-${decision.overallRisk}`}>
          {decision.overallRisk} risk
        </div>
        <div className="summary-grid">
          <div className="metric">
            <span>Score</span>
            <strong>{decision.score}/100</strong>
          </div>
          <div className="metric">
            <span>Token</span>
            <strong>
              {evidence.token.name} ({evidence.token.symbol})
            </strong>
          </div>
        </div>
        <h3>Top Risks</h3>
        <ul className="risk-list">
          {decision.topRisks.map((risk) => (
            <li key={`${risk.label}-${risk.severity}`}>
              <div className="risk-meta">
                <strong>{risk.label}</strong>
                <span>{risk.severity}</span>
              </div>
              <div className="muted">{risk.evidence}</div>
            </li>
          ))}
        </ul>
        <h3>Verify Next</h3>
        <ul className="check-list">
          {decision.whatToVerifyNext.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
        <h3>Strategy Options</h3>
        <div className="strategy-grid">
          {Object.entries(decision.strategyOptions).map(([name, option]) => (
            <article className="strategy-card" key={name}>
              <h4>{name}</h4>
              <p>{option.summary}</p>
              <strong>Entry</strong>
              <p>{option.entryPlan}</p>
              <strong>Exit</strong>
              <p>{option.exitPlan}</p>
              <strong>Position Sizing</strong>
              <p>{option.positionSizingHint}</p>
            </article>
          ))}
        </div>
        <p className="muted">{decision.disclaimer}</p>
      </section>

      <section className="evidence-card">
        <h3>Evidence Snapshot</h3>
        <div className="facts-grid">
          <div className="metric">
            <span>Liquidity</span>
            <strong>{formatCurrency(evidence.market.liquidityUsd)}</strong>
          </div>
          <div className="metric">
            <span>Market Cap</span>
            <strong>{formatCurrency(evidence.market.marketCapUsd)}</strong>
          </div>
          <div className="metric">
            <span>24h Volume</span>
            <strong>{formatCurrency(evidence.market.volume24hUsd)}</strong>
          </div>
          <div className="metric">
            <span>Top 10 Holders</span>
            <strong>{formatPercent(evidence.holders.top10SharePct)}</strong>
          </div>
        </div>
        <ul className="check-list">
          <li>
            Mint authority active:{" "}
            <strong>
              {evidence.authorities.mintAuthorityActive ? "Yes" : "No"}
            </strong>
          </li>
          <li>
            Freeze authority active:{" "}
            <strong>
              {evidence.authorities.freezeAuthorityActive ? "Yes" : "No"}
            </strong>
          </li>
          <li>
            Liquidity locked:{" "}
            <strong>{formatPercent(evidence.authorities.lpLockedPct)}</strong>
          </li>
        </ul>
      </section>

      <section className="trace-card">
        <h3>Runtime Trace</h3>
        <div className="trace-grid">
          <div className="trace-item">
            <span>Signals Provider</span>
            <strong>{runtime.signalsProvider}</strong>
          </div>
          <div className="trace-item">
            <span>Inference Provider</span>
            <strong>{runtime.inferenceProvider}</strong>
          </div>
          <div className="trace-item">
            <span>Request ID</span>
            <strong>{response.requestId}</strong>
          </div>
          <div className="trace-item">
            <span>Generated</span>
            <strong>{new Date(runtime.generatedAt).toLocaleString()}</strong>
          </div>
        </div>
      </section>
    </>
  );
}

