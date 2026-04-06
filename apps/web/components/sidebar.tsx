"use client";

import { useState } from "react";
import { useSessions, useActiveSessionId } from "@/lib/use-session-store";
import { createSession, setActiveSession } from "@/lib/session-store";

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 60_000) return "now";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface SidebarProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export function Sidebar({ theme, onToggleTheme }: SidebarProps) {
  const sessions = useSessions();
  const activeId = useActiveSessionId();
  const [walletHover, setWalletHover] = useState(false);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <h1>INTENTVAULT</h1>
          <span className="brand-cursor" />
        </div>
        <button
          className="theme-toggle"
          onClick={onToggleTheme}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? "\u2600" : "\u263E"}
        </button>
      </div>

      {/* Wallet connect preview */}
      <div
        className="wallet-preview"
        onMouseEnter={() => setWalletHover(true)}
        onMouseLeave={() => setWalletHover(false)}
      >
        <button className="wallet-btn" disabled>
          <span className="wallet-icon">{"\uD83D\uDCBB"}</span>
          <span className="wallet-text">
            {walletHover ? "Coming soon" : "Connect Wallet"}
          </span>
        </button>
        <span className="wallet-hint">Read-only &middot; No signing</span>
      </div>

      <button className="new-chat-btn" onClick={() => createSession()}>
        + new_investigation
      </button>

      <div className="session-list">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`session-item ${session.id === activeId ? "active" : ""}`}
            onClick={() => setActiveSession(session.id)}
          >
            <span className="session-item-icon">&gt;</span>
            <span className="session-item-title">{session.title}</span>
            <span className="session-item-time">
              {formatTime(session.updatedAt)}
            </span>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <span>
          Powered by{" "}
          <a href="https://www.solrouter.com" target="_blank" rel="noopener noreferrer">
            SolRouter
          </a>
        </span>
        <span>Encrypted Inference &middot; Arcium TEE</span>
      </div>
    </aside>
  );
}
