"use client";

import {
  useState,
  useRef,
  useEffect,
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
/* Templates                                                           */
/* ------------------------------------------------------------------ */

interface Template {
  id: string;
  label: string;
  description: string;
  placeholder: string;
}

const TEMPLATES: Template[] = [
  {
    id: "investigate-token",
    label: "Investigate Token",
    description: "Analyze a Solana token's risk, liquidity, and market signals privately",
    placeholder: "Enter a token mint address or symbol (e.g., BONK, SOL, JUP)..."
  },
  {
    id: "compare-tokens",
    label: "Compare Tokens",
    description: "Side-by-side comparison of two tokens (coming soon)",
    placeholder: "Compare feature coming soon..."
  },
  {
    id: "portfolio-scan",
    label: "Portfolio Scan",
    description: "Scan a wallet's holdings for risk exposure (coming soon)",
    placeholder: "Portfolio scan coming soon..."
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const messages = session?.messages ?? [];

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isLoading]);

  // Focus input on session change
  useEffect(() => {
    inputRef.current?.focus();
  }, [session?.id]);

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

    // Run the investigation workflow
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

        const data = await res.json();

        if (!res.ok) {
          const errMsg = createChatMessage(
            "assistant",
            `I couldn't complete the investigation: ${data.error ?? "Unknown error"}. Try checking the token address or symbol and retry.`
          );
          addMessage(sid, errMsg);
        } else {
          const workflow = data as WorkflowResponse;
          const evidence = workflow.evidence;
          const risk = workflow.decision;

          // Build a text summary
          const summary = [
            `Here's the investigation for **${evidence.token.name ?? evidence.token.symbol ?? text}**:`,
            "",
            `Risk level: **${risk.overallRisk.toUpperCase()}** (score ${risk.score}/100).`,
            risk.topRisks.length > 0
              ? `Top concern: ${risk.topRisks[0].label} — ${risk.topRisks[0].evidence}`
              : "",
            "",
            "I've generated a full decision card with market data, risk factors, and strategy options below."
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
      // Other templates not implemented yet
      const pendingMsg = createChatMessage(
        "assistant",
        `The **${TEMPLATES.find((t) => t.id === activeTemplate)?.label ?? activeTemplate}** template is coming soon. For now, you can use **Investigate Token** to analyze any Solana token.`
      );
      addMessage(sid, pendingMsg);
    }

    setIsLoading(false);
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
    if (templateId !== "investigate-token") return;
    if (!session) createSession();
    inputRef.current?.focus();
  }

  const currentTemplate = TEMPLATES.find((t) => t.id === activeTemplate) ?? TEMPLATES[0];
  const isActive = activeTemplate === "investigate-token";

  return (
    <div className="chat-area">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <h2>{currentTemplate.label}</h2>
          <div className="provider-badges">
            <span className="provider-badge live">DexScreener Live</span>
            <span className="provider-badge">SolRouter</span>
            <span className="provider-badge">Devnet</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container">
        <div className="messages-inner">
          {messages.length === 0 && !isLoading ? (
            <div className="welcome-screen">
              <div className="welcome-logo">IntentVault</div>
              <p>
                Privacy-first Solana token investigation. Public market signals
                stay public. Your intent and strategy stay inside the private
                inference boundary.
              </p>
              <div className="template-cards">
                {TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    className="template-trigger"
                    onClick={() => handleTemplateClick(tmpl.id)}
                  >
                    <strong>{tmpl.label}</strong>
                    <span>{tmpl.description}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id} className="message">
                  <div className={`message-avatar ${msg.role}`}>
                    {msg.role === "user" ? "Y" : "IV"}
                  </div>
                  <div className="message-body">
                    <div className="message-meta">
                      <span className="message-sender">
                        {msg.role === "user" ? "You" : "IntentVault"}
                      </span>
                      <span className="message-time">{formatTime(msg.timestamp)}</span>
                    </div>
                    <div className="message-text">
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

          {isLoading && (
            <div className="message">
              <div className="message-avatar assistant">IV</div>
              <div className="message-body">
                <div className="thinking-indicator">
                  <div className="thinking-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                  Investigating token signals...
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
          <div className="template-config">
            <label>Template:</label>
            <select
              className="config-select"
              value={activeTemplate}
              onChange={(e) => setActiveTemplate(e.target.value)}
            >
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                  {t.id !== "investigate-token" ? " (soon)" : ""}
                </option>
              ))}
            </select>

            <div className="config-divider" />

            <label>Risk:</label>
            <select
              className="config-select"
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
              className="config-select"
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

          <div className="input-hint">
            Enter a token mint address or symbol. Your intent stays private.
            Solana Devnet &middot; No wallet signing &middot; No server history
          </div>
        </div>
      </div>
    </div>
  );
}
