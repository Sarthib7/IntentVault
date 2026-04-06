"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import type {
  InvestigationRequest,
  WorkflowResponse
} from "@intentvault/schemas";
import { DecisionCard } from "@/components/decision-card";

const initialFormState: InvestigationRequest = {
  tokenQuery: "",
  riskMode: "balanced",
  timeHorizon: "mid",
  notes: "",
  walletContext: ""
};

export function InvestigationWorkspace() {
  const [formState, setFormState] =
    useState<InvestigationRequest>(initialFormState);
  const [response, setResponse] = useState<WorkflowResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const apiResponse = await fetch("/api/workflow/investigate-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formState)
      });

      const payload = await apiResponse.json();

      if (!apiResponse.ok) {
        throw new Error(payload.error ?? "Workflow request failed");
      }

      setResponse(payload as WorkflowResponse);
    } catch (error) {
      setResponse(null);
      setErrorMessage(
        error instanceof Error ? error.message : "Unknown request failure"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateField<Key extends keyof InvestigationRequest>(
    key: Key,
    value: InvestigationRequest[Key]
  ) {
    setFormState((current) => ({
      ...current,
      [key]: value
    }));
  }

  return (
    <div className="surface">
      <header className="workspace-header">
        <div className="status-badges">
          <span className="mini-badge">Structured workflow</span>
          <span className="mini-badge">Private notes supported</span>
          <span className="mini-badge">Mock evidence mode by default</span>
        </div>
        <h2>Investigate Token (Private)</h2>
        <p className="muted">
          Capture the public facts you need while keeping your intent and
          strategy notes inside the inference boundary.
        </p>
      </header>

      <div className="workspace-layout">
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="tokenQuery">Token mint or symbol</label>
            <input
              id="tokenQuery"
              name="tokenQuery"
              placeholder="BONK or So11111111111111111111111111111111111111112"
              required
              value={formState.tokenQuery}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                updateField("tokenQuery", event.target.value)
              }
            />
          </div>

          <div className="field-grid">
            <div className="field">
              <label htmlFor="riskMode">Risk mode</label>
              <select
                id="riskMode"
                name="riskMode"
                value={formState.riskMode}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  updateField(
                    "riskMode",
                    event.target.value as InvestigationRequest["riskMode"]
                  )
                }
              >
                <option value="safe">Safe</option>
                <option value="balanced">Balanced</option>
                <option value="aggressive">Aggressive</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="timeHorizon">Time horizon</label>
              <select
                id="timeHorizon"
                name="timeHorizon"
                value={formState.timeHorizon}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  updateField(
                    "timeHorizon",
                    event.target.value as InvestigationRequest["timeHorizon"]
                  )
                }
              >
                <option value="short">Short</option>
                <option value="mid">Mid</option>
                <option value="long">Long</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="walletContext">Optional wallet context</label>
            <input
              id="walletContext"
              name="walletContext"
              placeholder="Public key only"
              value={formState.walletContext ?? ""}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                updateField("walletContext", event.target.value)
              }
            />
          </div>

          <div className="field">
            <label htmlFor="notes">Private notes and constraints</label>
            <textarea
              id="notes"
              name="notes"
              placeholder="Example: I care about downside protection, want low slippage, and I do not want exposure if top holders dominate supply."
              value={formState.notes ?? ""}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                updateField("notes", event.target.value)
              }
            />
          </div>

          <div className="submit-row">
            <button className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? "Investigating..." : "Investigate Privately"}
            </button>
            <span className="muted">
              The current build stores no server-side history.
            </span>
          </div>
        </form>

        {errorMessage ? (
          <section className="status-card">
            <strong className="error-message">Workflow error</strong>
            <p>{errorMessage}</p>
          </section>
        ) : null}

        {!response && !errorMessage ? (
          <section className="status-card">
            Submit the form to generate a structured decision card. In local
            mode the workflow runs entirely without external public-signal keys.
          </section>
        ) : null}

        {response ? <DecisionCard response={response} /> : null}
      </div>
    </div>
  );
}
