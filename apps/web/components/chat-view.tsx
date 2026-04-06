"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent
} from "react";
import { useActiveSession } from "@/lib/use-session-store";
import { createSession, addMessage } from "@/lib/session-store";
import type {
  ChatMessage,
  InvestigationRequest,
  WorkflowResponse
} from "@intentvault/schemas";
import { ChatDecisionCard } from "./chat-decision-card";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface WorkflowStep {
  step: string;
  status: "running" | "done" | "error";
  detail?: string;
}

interface Template {
  id: string;
  label: string;
  description: string;
  placeholder: string;
  enabled: boolean;
}

const TEMPLATES: Template[] = [
  {
    id: "investigate-token",
    label: "Investigate Token",
    description: "Analyze a Solana token's risk, liquidity, and market signals privately",
    placeholder: "Enter a token mint address or symbol (e.g., BONK, SOL, JUP)...",
    enabled: true
  },
  {
    id: "compare-tokens",
    label: "Compare Tokens",
    description: "Side-by-side comparison of two tokens (coming soon)",
    placeholder: "Compare feature coming soon...",
    enabled: false
  },
  {
    id: "portfolio-scan",
    label: "Portfolio Scan",
    description: "Scan a wallet's holdings for risk exposure (coming soon)",
    placeholder: "Portfolio scan coming soon...",
    enabled: false
  }
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function createChatMessage(
  role: "user" | "assistant" | "system",
  content: string,
  extra?: Partial<ChatMessage>
): ChatMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role,
    content,
    timestamp: new Date().toISOString(),
    ...extra
  };
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });
}

function stepIcon(status: string): string {
  switch (status) {
    case "running":
      return "\u25CF"; // ●
    case "done":
      return "\u2713"; // ✓
    case "error":
      return "\u2717"; // ✗
    default:
      return "\u25CB"; // ○
  }
}

/* ------------------------------------------------------------------ */
/* SSE Parser                                                          */
/* ------------------------------------------------------------------ */

async function consumeSSE(
  response: Response,
  onStep: (step: WorkflowStep) => void,
  onResult: (data: WorkflowResponse) => void,
  onError: (error: string) => void
) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    let eventType = "";
    let dataStr = "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        dataStr = line.slice(6);
      } else if (line === "" && eventType && dataStr) {
        try {
          const parsed = JSON.parse(dataStr);
          switch (eventType) {
            case "step":
              onStep(parsed as WorkflowStep);
              break;
            case "result":
              onResult(parsed as WorkflowResponse);
              break;
            case "error":
              onError(parsed.error ?? "Unknown error");
              break;
          }
        } catch {
          // skip malformed events
        }
        eventType = "";
        dataStr = "";
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function ChatView() {
  const session = useActiveSession();
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [riskMode, setRiskMode] = useState<"safe" | "balanced" | "aggressive">("balanced");
  const [timeHorizon, setTimeHorizon] = useState<"short" | "mid" | "long">("mid");
  const [activeTemplate, setActiveTemplate] = useState<string>("investigate-token");

  // Streaming state
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const messages = session?.messages ?? [];

  // Auto-scroll to bottom on new messages or steps
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isLoading, workflowSteps.length]);

  // Focus input on session change
  useEffect(() => {
    inputRef.current?.focus();
  }, [session?.id]);

  const handleStep = useCallback((step: WorkflowStep) => {
    setWorkflowSteps((prev) => {
      const idx = prev.findIndex((s) => s.step === step.step);
      if (idx >= 0) {
        // Update existing step
        const updated = [...prev];
        updated[idx] = step;
        return updated;
      }
      // Add new step
      return [...prev, step];
    });
  }, []);

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    const text = inputValue.trim();
    if (!text || isLoading) return;

    // Ensure we have a session
    let sid = session?.id;
    if (!sid) {
      const s = createSession();
      sid = s.id;
    }

    // Add user message
    const userMsg = createChatMessage("user", text, {
      templateId: activeTemplate
    });
    addMessage(sid, userMsg);
    setInputValue("");
    setIsLoading(true);
    setWorkflowSteps([]);

    if (activeTemplate === "investigate-token") {
      try {
        const payload: InvestigationRequest = {
          tokenQuery: text,
          riskMode,
          timeHorizon,
          notes: "",
          walletContext: ""
        };

        const res = await fetch("/api/workflow/investigate-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          let errorMsg = "Unknown error";
          try {
            const errData = await res.json();
            errorMsg = errData.error ?? errorMsg;
          } catch {
            // non-JSON error
          }
          const errMsg = createChatMessage(
            "assistant",
            `I couldn't complete the investigation: ${errorMsg}. Try checking the token address or symbol and retry.`
          );
          addMessage(sid, errMsg);
          setIsLoading(false);
          setWorkflowSteps([]);
          return;
        }

        // Consume the SSE stream
        let finalResult: WorkflowResponse | null = null;

        await consumeSSE(
          res,
          handleStep,
          (result) => {
            finalResult = result;
          },
          (error) => {
            const errMsg = createChatMessage(
              "assistant",
              `Investigation failed: ${error}`
            );
            addMessage(sid!, errMsg);
          }
        );

        if (finalResult) {
          const workflow = finalResult as WorkflowResponse;
          const evidence = workflow.evidence;
          const risk = workflow.decision;

          const summary = [
            `Investigation complete for **${evidence.token.name ?? evidence.token.symbol ?? text}**.`,
            "",
            `Risk level: **${risk.overallRisk.toUpperCase()}** (score ${risk.score}/100).`,
            risk.topRisks.length > 0
              ? `Top concern: ${risk.topRisks[0].label} \u2014 ${risk.topRisks[0].evidence}`
              : "",
            "",
            "Full decision card with market data, risk factors, and strategy options below."
          ]
            .filter(Boolean)
            .join("\n");

          const assistantMsg = createChatMessage("assistant", summary, {
            workflowResponse: workflow,
            templateId: activeTemplate
          });
          addMessage(sid, assistantMsg);
        }
      } catch (err) {
        const errMsg = createChatMessage(
          "assistant",
          `Something went wrong while running the investigation. ${err instanceof Error ? err.message : "Please try again."}`
        );
        addMessage(sid, errMsg);
      }
    } else {
      const pendingMsg = createChatMessage(
        "assistant",
        `The **${TEMPLATES.find((t) => t.id === activeTemplate)?.label ?? activeTemplate}** template is coming soon. For now, you can use **Investigate Token** to analyze any Solana token.`
      );
      addMessage(sid, pendingMsg);
    }

    setIsLoading(false);
    setWorkflowSteps([]);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleTemplateClick(templateId: string) {
    setActiveTemplate(templateId);
    if (!TEMPLATES.find((t) => t.id === templateId)?.enabled) return;
    if (!session) createSession();
    inputRef.current?.focus();
  }

  const currentTemplate = TEMPLATES.find((t) => t.id === activeTemplate) ?? TEMPLATES[0];
  const isActive = currentTemplate.enabled;

  return (
    <div className="chat-area">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <h2>{currentTemplate.label}</h2>
          <div className="provider-tags">
            <span className="provider-tag active">DexScreener Live</span>
            <span className="provider-tag">SolRouter</span>
            <span className="provider-tag">Devnet</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container">
        <div className="messages-inner">
          {messages.length === 0 && !isLoading ? (
            <div className="welcome-screen">
              <div className="welcome-brand">
                Intent<span>Vault</span>
              </div>
              <p className="welcome-desc">
                Privacy-first Solana token investigation. Public market signals
                stay public. Your intent and strategy stay inside the private
                inference boundary.
              </p>
              <div className="template-grid">
                {TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    className="template-btn"
                    onClick={() => handleTemplateClick(tmpl.id)}
                    disabled={!tmpl.enabled}
                  >
                    <span className="template-btn-name">{tmpl.label}</span>
                    <span className="template-btn-desc">{tmpl.description}</span>
                    {!tmpl.enabled && (
                      <span className="template-btn-badge" style={{ background: "var(--warning-dim)", color: "var(--warning)" }}>
                        soon
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="welcome-hint">
                try: BONK, SOL, JUP, or any Solana mint address
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id} className="message">
                  <div className={`msg-indicator ${msg.role}`} />
                  <div className="msg-body">
                    <div className="msg-meta">
                      <span className={`msg-sender ${msg.role}`}>
                        {msg.role === "user" ? "you" : "intentvault"}
                      </span>
                      <span className="msg-time">{formatTime(msg.timestamp)}</span>
                    </div>
                    <div className="msg-text">
                      {msg.content.split("\n").map((line, i) => (
                        <p key={i}>
                          {line.split(/\*\*(.*?)\*\*/g).map((part, j) =>
                            j % 2 === 1 ? (
                              <strong key={j}>{part}</strong>
                            ) : (
                              <span key={j}>{part}</span>
                            )
                          )}
                        </p>
                      ))}
                    </div>
                    {msg.workflowResponse && (
                      <ChatDecisionCard response={msg.workflowResponse} />
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Live workflow steps during streaming */}
          {isLoading && workflowSteps.length > 0 && (
            <div className="message">
              <div className="msg-indicator assistant" />
              <div className="msg-body">
                <div className="msg-meta">
                  <span className="msg-sender assistant">intentvault</span>
                  <span className="msg-time">now</span>
                </div>
                <div className="workflow-steps">
                  {workflowSteps.map((ws, i) => (
                    <div key={`${ws.step}-${i}`} className={`wf-step ${ws.status}`}>
                      <span className="wf-step-icon">{stepIcon(ws.status)}</span>
                      <span className="wf-step-label">{ws.step}</span>
                      {ws.detail && (
                        <span className="wf-step-detail">{ws.detail}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Fallback loading indicator when no steps yet */}
          {isLoading && workflowSteps.length === 0 && (
            <div className="message">
              <div className="msg-indicator assistant" />
              <div className="msg-body">
                <div className="msg-meta">
                  <span className="msg-sender assistant">intentvault</span>
                  <span className="msg-time">now</span>
                </div>
                <div className="workflow-steps">
                  <div className="wf-step running">
                    <span className="wf-step-icon">{stepIcon("running")}</span>
                    <span className="wf-step-label">Connecting to investigation pipeline...</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="input-bar">
        <div className="input-bar-inner">
          <div className="input-config">
            <label>Template:</label>
            <select
              className="cfg-select"
              value={activeTemplate}
              onChange={(e) => setActiveTemplate(e.target.value)}
            >
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                  {!t.enabled ? " (soon)" : ""}
                </option>
              ))}
            </select>

            <div className="cfg-divider" />

            <label>Risk:</label>
            <select
              className="cfg-select"
              value={riskMode}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setRiskMode(e.target.value as typeof riskMode)
              }
            >
              <option value="safe">Safe</option>
              <option value="balanced">Balanced</option>
              <option value="aggressive">Aggressive</option>
            </select>

            <label>Horizon:</label>
            <select
              className="cfg-select"
              value={timeHorizon}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setTimeHorizon(e.target.value as typeof timeHorizon)
              }
            >
              <option value="short">Short</option>
              <option value="mid">Mid</option>
              <option value="long">Long</option>
            </select>
          </div>

          <form className="input-row" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              className="input-field"
              placeholder={currentTemplate.placeholder}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isLoading || !isActive}
            />
            <button
              type="submit"
              className="send-btn"
              disabled={!inputValue.trim() || isLoading || !isActive}
              title="Investigate"
            >
              &rarr;
            </button>
          </form>

          <div className="input-footer">
            Enter a token mint address or symbol. Your intent stays private.
            Solana Devnet &middot; No wallet signing &middot; No server history
          </div>
        </div>
      </div>
    </div>
  );
}
