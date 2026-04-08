"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
  type FormEvent,
  type KeyboardEvent
} from "react";
import { classifyInput } from "@/lib/input-intent";
import { useActiveSession } from "@/lib/use-session-store";
import { createSession, addMessage } from "@/lib/session-store";
import type {
  ChatMessage,
  GeneralChatResponse,
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
  | "idle"
  | "confirm-token"
  | "ask-risk"
  | "ask-horizon"
  | "ask-depth"
  | "investigating";

interface PendingInvestigation {
  tokenQuery: string;
  riskMode: "safe" | "balanced" | "aggressive";
  timeHorizon: "short" | "mid" | "long";
  depth: "quick" | "deep";
}

const SOLROUTER_MODELS = [
  { value: "gpt-oss-20b", label: "GPT-OSS 20B", cost: "$0.15/M" },
  { value: "gemini-flash", label: "Gemini Flash", cost: "$0.08/M" },
  { value: "claude-sonnet", label: "Claude Sonnet", cost: "$3.00/M" },
  { value: "claude-sonnet-4", label: "Claude Sonnet 4", cost: "$3.00/M" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini", cost: "$0.15/M" }
];

const STARTER_PROMPTS = [
  "what's cooking",
  "deep research the history of Solana",
  "Should I buy BONK?",
  "compare btc and sol for a long-term thesis"
];

/* ------------------------------------------------------------------ */
/* Welcome screen content                                              */
/* ------------------------------------------------------------------ */

interface Capability {
  icon: string;
  title: string;
  description: string;
  badge: "live" | "soon" | "planned";
}

type MessageBlock =
  | { type: "paragraph"; text: string }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] }
  | { type: "table"; header: string[]; rows: string[][] };

const CAPABILITIES: Capability[] = [
  {
    icon: "\uD83D\uDD12",
    title: "Private by default",
    description: "Intent stays in the encrypted inference path instead of becoming UI noise or public prompt context.",
    badge: "live"
  },
  {
    icon: "\uD83D\uDD0D",
    title: "Research without routing mistakes",
    description: "Normal questions stay chat. Deep research stays topic research. Token workflows start only after confirmation.",
    badge: "live"
  },
  {
    icon: "\uD83C\uDFAF",
    title: "Token flows when you ask",
    description: "If you ask about BONK, BTC, or SOL, the system confirms the asset before moving into structured investigation.",
    badge: "live"
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
    case "running": return "\u25CF";
    case "done":    return "\u2713";
    case "error":   return "\u2717";
    default:        return "\u25CB";
  }
}

function renderInlineContent(text: string): ReactNode[] {
  return text.split(/\*\*(.*?)\*\*/g).map((part, index) =>
    index % 2 === 1 ? <strong key={index}>{part}</strong> : <span key={index}>{part}</span>
  );
}

function isTableLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.includes("|", 1);
}

function splitTableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparatorLine(line: string): boolean {
  const cells = splitTableCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, "")));
}

function parseMessageBlocks(content: string): MessageBlock[] {
  const lines = content.split("\n");
  const blocks: MessageBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const currentLine = lines[index]?.trim() ?? "";

    if (!currentLine) {
      index += 1;
      continue;
    }

    const nextLine = lines[index + 1]?.trim() ?? "";
    if (isTableLine(currentLine) && nextLine && isTableSeparatorLine(nextLine)) {
      const header = splitTableCells(currentLine);
      const rows: string[][] = [];
      index += 2;

      while (index < lines.length) {
        const rowLine = lines[index]?.trim() ?? "";
        if (!isTableLine(rowLine)) {
          break;
        }

        rows.push(splitTableCells(rowLine));
        index += 1;
      }

      blocks.push({ type: "table", header, rows });
      continue;
    }

    if (/^[-*]\s+/.test(currentLine)) {
      const items: string[] = [];
      while (index < lines.length) {
        const listLine = lines[index]?.trim() ?? "";
        if (!/^[-*]\s+/.test(listLine)) {
          break;
        }

        items.push(listLine.replace(/^[-*]\s+/, "").trim());
        index += 1;
      }

      blocks.push({ type: "unordered-list", items });
      continue;
    }

    if (/^\d+\.\s+/.test(currentLine)) {
      const items: string[] = [];
      while (index < lines.length) {
        const listLine = lines[index]?.trim() ?? "";
        if (!/^\d+\.\s+/.test(listLine)) {
          break;
        }

        items.push(listLine.replace(/^\d+\.\s+/, "").trim());
        index += 1;
      }

      blocks.push({ type: "ordered-list", items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const paragraphLine = lines[index]?.trim() ?? "";
      const paragraphNextLine = lines[index + 1]?.trim() ?? "";

      if (!paragraphLine) {
        break;
      }

      if (/^[-*]\s+/.test(paragraphLine) || /^\d+\.\s+/.test(paragraphLine)) {
        break;
      }

      if (isTableLine(paragraphLine) && paragraphNextLine && isTableSeparatorLine(paragraphNextLine)) {
        break;
      }

      paragraphLines.push(paragraphLine);
      index += 1;
    }

    if (paragraphLines.length > 0) {
      blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
      continue;
    }

    index += 1;
  }

  if (blocks.length === 0) {
    return [{ type: "paragraph", text: content.trim() }];
  }

  return blocks;
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

  // Conversational MCQ
  const [phase, setPhase] = useState<ConversationPhase>("idle");
  const [pending, setPending] = useState<Partial<PendingInvestigation>>({});

  // Streaming
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const messages = session?.messages ?? [];

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth"
    });
  }, [messages.length, isLoading, workflowSteps.length, phase]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [session?.id, phase]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    input.style.height = "0px";
    input.style.height = `${input.scrollHeight}px`;
  }, [inputValue, phase]);

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

  /* ---------- MCQ handler ---------- */

  function handleMCQChoice(choice: string) {
    let sid = session?.id;
    if (!sid) { sid = createSession().id; }

    addMessage(sid, createChatMessage("user", choice));

    if (phase === "confirm-token") {
      if (choice === "Yes") {
        addMessage(sid, createChatMessage("assistant", "What's your risk tolerance?"));
        setPhase("ask-risk");
      } else {
        setPending({});
        setPhase("idle");
        addMessage(
          sid,
          createChatMessage(
            "assistant",
            "Tell me the token symbol or mint address you want me to investigate."
          )
        );
      }

    } else if (phase === "ask-risk") {
      const riskMap: Record<string, "safe" | "balanced" | "aggressive"> = {
        "Conservative": "safe",
        "Balanced": "balanced",
        "Aggressive": "aggressive"
      };
      setPending((p) => ({ ...p, riskMode: riskMap[choice] ?? "balanced" }));
      addMessage(sid, createChatMessage("assistant", "Time horizon for this position?"));
      setPhase("ask-horizon");

    } else if (phase === "ask-horizon") {
      const horizonMap: Record<string, "short" | "mid" | "long"> = {
        "Short (hours\u2013days)": "short",
        "Mid (days\u2013weeks)": "mid",
        "Long (weeks+)": "long"
      };
      setPending((p) => ({ ...p, timeHorizon: horizonMap[choice] ?? "mid" }));
      addMessage(sid, createChatMessage("assistant", "How deep should SolRouter investigate?"));
      setPhase("ask-depth");

    } else if (phase === "ask-depth") {
      const depth = choice === "Deep Research" ? "deep" : "quick";
      const finalPending = { ...pending, depth } as PendingInvestigation;
      setPending(finalPending);
      addMessage(sid, createChatMessage("assistant",
        `Routing to SolRouter ${depth === "deep" ? "deep research" : "quick scan"} pipeline...`
      ));
      setPhase("investigating");
      runInvestigation(sid, finalPending);
    }
  }

  /* ---------- Submit ---------- */

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    const text = inputValue.trim();
    if (!text || isLoading || phase !== "idle") return;

    let sid = session?.id;
    if (!sid) { sid = createSession().id; }

    addMessage(sid, createChatMessage("user", text));
    setInputValue("");

    const intent = classifyInput(text);
    if (intent.mode === "chat" || intent.mode === "research") {
      await runGeneralChat(sid, text, intent.mode);
      return;
    }

    if (intent.mode === "need-token") {
      addMessage(
        sid,
        createChatMessage(
          "assistant",
          "Which token or mint address do you want me to investigate?"
        )
      );
      return;
    }

    setPending({ tokenQuery: intent.tokenQuery });
    addMessage(
      sid,
      createChatMessage(
        "assistant",
        `I think you want to investigate **${intent.tokenQuery}**. Is that the token or mint address?`
      )
    );
    setPhase("confirm-token");
  }

  /* ---------- Investigation ---------- */

  async function runGeneralChat(
    sid: string,
    message: string,
    mode: "chat" | "research"
  ) {
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          sessionId: sid,
          model,
          mode
        })
      });

      if (!res.ok) {
        let errorMsg = "Unknown error";
        try {
          const data = await res.json();
          errorMsg = data.error ?? errorMsg;
        } catch {
          // Ignore malformed error payloads.
        }
        addMessage(sid, createChatMessage("assistant", `Chat error: ${errorMsg}`));
        return;
      }

      const data = (await res.json()) as GeneralChatResponse;
      addMessage(sid, createChatMessage("assistant", data.reply));
    } catch (err) {
      addMessage(
        sid,
        createChatMessage(
          "assistant",
          `Error: ${err instanceof Error ? err.message : "Please try again."}`
        )
      );
    } finally {
      setIsLoading(false);
    }
  }

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
          `SolRouter pipeline error: ${errorMsg}`
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
          addMessage(sid, createChatMessage("assistant", `Pipeline error: ${error}`));
        }
      );

      if (finalResult) {
        const workflow = finalResult as WorkflowResponse;
        const evidence = workflow.evidence;
        const risk = workflow.decision;

        const summary = [
          `**${evidence.token.name ?? evidence.token.symbol ?? config.tokenQuery}** \u2014 SolRouter analysis complete.`,
          "",
          `Risk: **${risk.overallRisk.toUpperCase()}** (${risk.score}/100)`,
          risk.topRisks.length > 0
            ? `Primary concern: ${risk.topRisks[0].label}`
            : "",
          "",
          `Inference: ${workflow.runtime.inferenceProvider} \u00B7 Signals: ${workflow.runtime.signalsProvider}`
        ].filter(Boolean).join("\n");

        addMessage(sid, createChatMessage("assistant", summary, {
          workflowResponse: workflow
        }));
      }
    } catch (err) {
      addMessage(sid, createChatMessage("assistant",
        `Error: ${err instanceof Error ? err.message : "Please try again."}`
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

  function getMCQOptions(): string[] {
    switch (phase) {
      case "confirm-token": return ["Yes", "No"];
      case "ask-risk":    return ["Conservative", "Balanced", "Aggressive"];
      case "ask-horizon": return ["Short (hours\u2013days)", "Mid (days\u2013weeks)", "Long (weeks+)"];
      case "ask-depth":   return ["Quick Scan", "Deep Research"];
      default:            return [];
    }
  }

  const mcqOptions = getMCQOptions();
  const showMCQ = mcqOptions.length > 0 && !isLoading;
  const currentModel = SOLROUTER_MODELS.find((m) => m.value === model);

  function handleStarterPrompt(prompt: string) {
    setInputValue(prompt);
    inputRef.current?.focus();
  }

  return (
    <div className="chat-area">
      <div className="chat-header">
        <div className="chat-header-left chat-header-copy">
          <div className="chat-title-block">
            <span className="chat-kicker">encrypted conversation</span>
            <h2>{phase === "idle" ? "What do you want to know?" : "Guided investigation in progress."}</h2>
          </div>
        </div>
        <div className="chat-header-right">
          <span className="chat-mode-tag">
            {phase === "idle" ? "chat mode" : "analysis flow"}
          </span>
          <span className="provider-tag">{currentModel?.label ?? model}</span>
        </div>
      </div>

      <div className="messages-container" ref={messagesContainerRef}>
        <div className="messages-inner">
          {messages.length === 0 && !isLoading && phase === "idle" ? (
            <div className="welcome-screen">
              <div className="welcome-panel">
                <span className="welcome-kicker">clean private research</span>
                <div className="welcome-brand">
                  Minimal chat. <span>Precise routing.</span>
                </div>
                <p className="welcome-desc">
                  Ask a normal question, request deep research on any topic, or ask about a token.
                  The interface should stay quiet until you need structured analysis.
                </p>
                <div className="welcome-actions">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="starter-chip"
                      onClick={() => handleStarterPrompt(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="landing-grid">
                {CAPABILITIES.map((cap) => (
                  <div key={cap.title} className="landing-card">
                    <div className="feature-card-top">
                      <span className="feature-icon">{cap.icon}</span>
                      <span className={`feature-badge ${cap.badge}`}>{cap.badge}</span>
                    </div>
                    <span className="landing-card-title">{cap.title}</span>
                    <span className="landing-card-desc">{cap.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id} className={`message ${msg.role}`}>
                  <div className={`msg-indicator ${msg.role}`} />
                  <div className="msg-body">
                    <div className="msg-meta">
                      <span className={`msg-sender ${msg.role}`}>
                        {msg.role === "user" ? "you" : "intentvault"}
                      </span>
                      <span className="msg-time">{formatTime(msg.timestamp)}</span>
                    </div>
                    <div className="msg-text">
                      {parseMessageBlocks(msg.content).map((block, index) => {
                        if (block.type === "paragraph") {
                          return (
                            <p key={index} className="msg-paragraph">
                              {renderInlineContent(block.text)}
                            </p>
                          );
                        }

                        if (block.type === "unordered-list") {
                          return (
                            <ul key={index} className="msg-list">
                              {block.items.map((item, itemIndex) => (
                                <li key={itemIndex}>{renderInlineContent(item)}</li>
                              ))}
                            </ul>
                          );
                        }

                        if (block.type === "ordered-list") {
                          return (
                            <ol key={index} className="msg-list ordered">
                              {block.items.map((item, itemIndex) => (
                                <li key={itemIndex}>{renderInlineContent(item)}</li>
                              ))}
                            </ol>
                          );
                        }

                        return (
                          <div key={index} className="msg-table-wrap">
                            <table className="msg-table">
                              <thead>
                                <tr>
                                  {block.header.map((cell, cellIndex) => (
                                    <th key={cellIndex}>{renderInlineContent(cell)}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {block.rows.map((row, rowIndex) => (
                                  <tr key={rowIndex}>
                                    {block.header.map((_, cellIndex) => (
                                      <td key={cellIndex}>
                                        {renderInlineContent(row[cellIndex] ?? "")}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      })}
                    </div>
                    {msg.workflowResponse && (
                      <ChatDecisionCard response={msg.workflowResponse} />
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* MCQ */}
          {showMCQ && (
            <div className="mcq-container">
              {mcqOptions.map((opt) => (
                <button key={opt} className="mcq-btn" onClick={() => handleMCQChoice(opt)}>
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Steps */}
          {isLoading && workflowSteps.length > 0 && (
            <div className="message assistant loading">
              <div className="msg-indicator assistant" />
              <div className="msg-body">
                <div className="msg-meta">
                  <span className="msg-sender assistant">solrouter</span>
                  <span className="msg-time">now</span>
                </div>
                <div className="workflow-steps">
                  {workflowSteps.map((ws, i) => (
                    <div key={`${ws.step}-${i}`} className={`wf-step ${ws.status}`}>
                      <span className="wf-step-icon">{stepIcon(ws.status)}</span>
                      <span className="wf-step-label">{ws.step}</span>
                      {ws.detail && <span className="wf-step-detail">{ws.detail}</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {isLoading && workflowSteps.length === 0 && (
            <div className="message assistant loading">
              <div className="msg-indicator assistant" />
              <div className="msg-body">
                <div className="workflow-steps">
                  <div className="wf-step running">
                    <span className="wf-step-icon">{stepIcon("running")}</span>
                    <span className="wf-step-label">Encrypting intent via SolRouter...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="input-bar">
        <div className="input-bar-inner">
          <form className="input-row" onSubmit={handleSubmit}>
            <div className="input-wrapper">
              <textarea
                ref={inputRef}
                className="input-field"
                placeholder={phase === "idle"
                  ? "Describe your intent... (token, question, or strategy)"
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
                    title="SolRouter model"
                  >
                    <span className="settings-lock">{"\uD83D\uDD12"}</span>
                    <span className="settings-model-name">
                      {currentModel?.label ?? model}
                    </span>
                    <span className="settings-chevron">{showSettings ? "\u25B4" : "\u25BE"}</span>
                  </button>

                  {showSettings && (
                    <div className="settings-dropdown">
                      <div className="settings-section">
                        <div className="settings-label">SolRouter Model</div>
                        <div className="settings-hint">All models use encrypted inference</div>
                        {SOLROUTER_MODELS.map((m) => (
                          <button
                            key={m.value}
                            type="button"
                            className={`settings-option ${model === m.value ? "active" : ""}`}
                            onClick={() => { setModel(m.value); setShowSettings(false); }}
                          >
                            <span>{m.label}</span>
                            <span className="settings-option-meta">
                              {m.cost}
                              {model === m.value && <span className="settings-check">{" \u2713"}</span>}
                            </span>
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
                  title="Send to SolRouter"
                >
                  &rarr;
                </button>
              </div>
            </div>
          </form>

          <div className="input-footer">
            encrypted via SolRouter &middot; Arcium RescueCipher &middot; TEE processing &middot; no plaintext logging
          </div>
        </div>
      </div>
    </div>
  );
}
