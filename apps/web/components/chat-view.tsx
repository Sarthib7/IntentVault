"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
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

type ConversationPhase =
  | "idle"            // waiting for user to type a token
  | "ask-risk"        // asking risk tolerance
  | "ask-horizon"     // asking time horizon
  | "ask-depth"       // asking quick scan vs deep research
  | "investigating";  // running the workflow

interface PendingInvestigation {
  tokenQuery: string;
  riskMode: "safe" | "balanced" | "aggressive";
  timeHorizon: "short" | "mid" | "long";
  depth: "quick" | "deep";
}

interface RoadmapFeature {
  label: string;
  description: string;
  badge: "live" | "soon" | "beta" | "planned";
  action?: string; // template id to activate
}

const FEATURES: RoadmapFeature[] = [
  {
    label: "Investigate Token",
    description: "Analyze risk, liquidity, and market signals privately via SolRouter",
    badge: "live",
    action: "investigate-token"
  },
  {
    label: "Deep Research",
    description: "Multi-phase analysis with holder patterns, authority audit, and LP analysis",
    badge: "live",
    action: "investigate-token"
  },
  {
    label: "DexScreener Live",
    description: "Real-time Solana market data from DexScreener API",
    badge: "live"
  },
  {
    label: "Compare Tokens",
    description: "Side-by-side risk comparison of two tokens",
    badge: "soon"
  },
  {
    label: "Portfolio Scan",
    description: "Scan a wallet's holdings for risk exposure",
    badge: "beta"
  },
  {
    label: "Jupiter Swap Sim",
    description: "Quote-only swap simulation via Jupiter",
    badge: "planned"
  }
];

const SOLROUTER_MODELS = [
  { value: "gpt-oss-20b", label: "GPT-OSS 20B" },
  { value: "gemini-flash", label: "Gemini Flash" },
  { value: "claude-sonnet", label: "Claude Sonnet" },
  { value: "claude-sonnet-4", label: "Claude Sonnet 4" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" }
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
    case "running": return "\u25CF";
    case "done":    return "\u2713";
    case "error":   return "\u2717";
    default:        return "\u25CB";
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
            case "step":   onStep(parsed as WorkflowStep); break;
            case "result": onResult(parsed as WorkflowResponse); break;
            case "error":  onError(parsed.error ?? "Unknown error"); break;
          }
        } catch { /* skip malformed */ }
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
  const [showSettings, setShowSettings] = useState(false);
  const [model, setModel] = useState("gpt-oss-20b");

  // Conversational MCQ state
  const [phase, setPhase] = useState<ConversationPhase>("idle");
  const [pending, setPending] = useState<Partial<PendingInvestigation>>({});

  // Streaming state
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const messages = session?.messages ?? [];

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isLoading, workflowSteps.length, phase]);

  // Focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, [session?.id, phase]);

  // Close settings dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleStep = useCallback((step: WorkflowStep) => {
    setWorkflowSteps((prev) => {
      const idx = prev.findIndex((s) => s.step === step.step);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = step;
        return updated;
      }
      return [...prev, step];
    });
  }, []);

  /* ---------- MCQ option handler ---------- */

  function handleMCQChoice(choice: string) {
    let sid = session?.id;
    if (!sid) { sid = createSession().id; }

    // Add user's choice as a message
    addMessage(sid, createChatMessage("user", choice));

    if (phase === "ask-risk") {
      const riskMap: Record<string, "safe" | "balanced" | "aggressive"> = {
        "Conservative / Safe": "safe",
        "Balanced": "balanced",
        "Aggressive / Degen": "aggressive"
      };
      const riskMode = riskMap[choice] ?? "balanced";
      setPending((p) => ({ ...p, riskMode }));

      // Ask horizon next
      addMessage(sid, createChatMessage("assistant",
        "What's your time horizon for this position?"
      ));
      setPhase("ask-horizon");

    } else if (phase === "ask-horizon") {
      const horizonMap: Record<string, "short" | "mid" | "long"> = {
        "Short (hours\u2013days)": "short",
        "Mid (days\u2013weeks)": "mid",
        "Long (weeks\u2013months)": "long"
      };
      const timeHorizon = horizonMap[choice] ?? "mid";
      setPending((p) => ({ ...p, timeHorizon }));

      // Ask depth
      addMessage(sid, createChatMessage("assistant",
        "How deep should I investigate?"
      ));
      setPhase("ask-depth");

    } else if (phase === "ask-depth") {
      const depth = choice === "Deep Research" ? "deep" : "quick";
      const finalPending = { ...pending, depth } as PendingInvestigation;
      setPending(finalPending);

      // Now run the investigation
      addMessage(sid, createChatMessage("assistant",
        `Starting ${depth === "deep" ? "deep research" : "quick scan"} for **${finalPending.tokenQuery}**...`
      ));
      setPhase("investigating");
      runInvestigation(sid, finalPending);
    }
  }

  /* ---------- Submit handler ---------- */

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    const text = inputValue.trim();
    if (!text || isLoading || phase !== "idle") return;

    let sid = session?.id;
    if (!sid) { sid = createSession().id; }

    // Add user message
    addMessage(sid, createChatMessage("user", text));
    setInputValue("");

    // Start conversational flow — ask risk tolerance
    setPending({ tokenQuery: text });
    addMessage(sid, createChatMessage("assistant",
      `Investigating **${text}**. First, what's your risk tolerance?`
    ));
    setPhase("ask-risk");
  }

  /* ---------- Run investigation ---------- */

  async function runInvestigation(sid: string, config: PendingInvestigation) {
    setIsLoading(true);
    setWorkflowSteps([]);

    try {
      const payload: InvestigationRequest = {
        tokenQuery: config.tokenQuery,
        riskMode: config.riskMode,
        timeHorizon: config.timeHorizon,
        notes: config.depth === "deep" ? "deep-research" : "",
        walletContext: ""
      };

      const endpoint = config.depth === "deep"
        ? "/api/workflow/deep-research"
        : "/api/workflow/investigate-token";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let errorMsg = "Unknown error";
        try { const d = await res.json(); errorMsg = d.error ?? errorMsg; } catch { /* */ }
        addMessage(sid, createChatMessage("assistant",
          `Investigation failed: ${errorMsg}. Check the token address or symbol and try again.`
        ));
        resetFlow();
        return;
      }

      let finalResult: WorkflowResponse | null = null;

      await consumeSSE(
        res,
        handleStep,
        (result) => { finalResult = result; },
        (error) => {
          addMessage(sid, createChatMessage("assistant", `Investigation failed: ${error}`));
        }
      );

      if (finalResult) {
        const workflow = finalResult as WorkflowResponse;
        const evidence = workflow.evidence;
        const risk = workflow.decision;

        const summary = [
          `Investigation complete for **${evidence.token.name ?? evidence.token.symbol ?? config.tokenQuery}**.`,
          "",
          `Risk level: **${risk.overallRisk.toUpperCase()}** (score ${risk.score}/100).`,
          risk.topRisks.length > 0
            ? `Top concern: ${risk.topRisks[0].label} \u2014 ${risk.topRisks[0].evidence}`
            : ""
        ].filter(Boolean).join("\n");

        addMessage(sid, createChatMessage("assistant", summary, {
          workflowResponse: workflow
        }));
      }
    } catch (err) {
      addMessage(sid, createChatMessage("assistant",
        `Something went wrong. ${err instanceof Error ? err.message : "Please try again."}`
      ));
    }

    resetFlow();
  }

  function resetFlow() {
    setIsLoading(false);
    setWorkflowSteps([]);
    setPhase("idle");
    setPending({});
    inputRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  /* ---------- MCQ options per phase ---------- */

  function getMCQOptions(): string[] {
    switch (phase) {
      case "ask-risk":
        return ["Conservative / Safe", "Balanced", "Aggressive / Degen"];
      case "ask-horizon":
        return ["Short (hours\u2013days)", "Mid (days\u2013weeks)", "Long (weeks\u2013months)"];
      case "ask-depth":
        return ["Quick Scan", "Deep Research"];
      default:
        return [];
    }
  }

  const mcqOptions = getMCQOptions();
  const showMCQ = mcqOptions.length > 0 && !isLoading;

  return (
    <div className="chat-area">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <h2>Investigate Token</h2>
          <div className="provider-tags">
            <span className="provider-tag active">DexScreener</span>
            <span className="provider-tag active">SolRouter</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container">
        <div className="messages-inner">
          {messages.length === 0 && !isLoading && phase === "idle" ? (
            <div className="welcome-screen">
              <div className="welcome-brand">
                Intent<span>Vault</span>
              </div>
              <p className="welcome-desc">
                Privacy-first Solana token investigation. Public market signals
                stay public. Your intent and strategy stay inside the private
                inference boundary.
              </p>

              <div className="feature-grid">
                {FEATURES.map((f) => (
                  <div
                    key={f.label}
                    className={`feature-card ${f.action ? "clickable" : ""}`}
                    onClick={() => {
                      if (f.action) inputRef.current?.focus();
                    }}
                  >
                    <div className="feature-card-top">
                      <span className={`feature-badge ${f.badge}`}>{f.badge}</span>
                      <span className="feature-name">{f.label}</span>
                    </div>
                    <span className="feature-desc">{f.description}</span>
                  </div>
                ))}
              </div>

              <div className="welcome-hint">
                type a token name or mint address to start
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

          {/* MCQ choices */}
          {showMCQ && (
            <div className="mcq-container">
              {mcqOptions.map((opt) => (
                <button
                  key={opt}
                  className="mcq-btn"
                  onClick={() => handleMCQChoice(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Live workflow steps */}
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

          {isLoading && workflowSteps.length === 0 && (
            <div className="message">
              <div className="msg-indicator assistant" />
              <div className="msg-body">
                <div className="workflow-steps">
                  <div className="wf-step running">
                    <span className="wf-step-icon">{stepIcon("running")}</span>
                    <span className="wf-step-label">Connecting to pipeline...</span>
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
          <form className="input-row" onSubmit={handleSubmit}>
            <div className="input-wrapper">
              <textarea
                ref={inputRef}
                className="input-field"
                placeholder={phase === "idle"
                  ? "Enter a token name or mint address..."
                  : "Select an option above..."
                }
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={isLoading || phase !== "idle"}
              />
              <div className="input-controls">
                <div className="settings-wrapper" ref={settingsRef}>
                  <button
                    type="button"
                    className={`settings-trigger ${showSettings ? "open" : ""}`}
                    onClick={() => setShowSettings(!showSettings)}
                    title="Model & settings"
                  >
                    <span className="settings-model-name">
                      {SOLROUTER_MODELS.find((m) => m.value === model)?.label ?? model}
                    </span>
                    <span className="settings-chevron">{showSettings ? "\u25B4" : "\u25BE"}</span>
                  </button>

                  {showSettings && (
                    <div className="settings-dropdown">
                      <div className="settings-section">
                        <div className="settings-label">SolRouter Model</div>
                        {SOLROUTER_MODELS.map((m) => (
                          <button
                            key={m.value}
                            type="button"
                            className={`settings-option ${model === m.value ? "active" : ""}`}
                            onClick={() => { setModel(m.value); setShowSettings(false); }}
                          >
                            {m.label}
                            {model === m.value && <span className="settings-check">{"\u2713"}</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="send-btn"
                  disabled={!inputValue.trim() || isLoading || phase !== "idle"}
                  title="Investigate"
                >
                  &rarr;
                </button>
              </div>
            </div>
          </form>

          <div className="input-footer">
            Your intent stays private &middot; Solana Devnet &middot; No wallet signing
          </div>
        </div>
      </div>
    </div>
  );
}
