"use client";

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

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-header-row">
          <div className="sidebar-brand">
            <div className="brand-mark">
              <span className="brand-cursor" />
            </div>
            <div className="sidebar-brand-copy">
              <span className="sidebar-kicker">private workflow layer</span>
              <h1>INTENTVAULT</h1>
            </div>
          </div>
          <button
            className="theme-toggle"
            onClick={onToggleTheme}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? "\u2600" : "\u263E"}
          </button>
        </div>

        <p className="sidebar-summary">
          Encrypted chat for topic research, token investigation, and signal-heavy questions without turning the interface into a dashboard.
        </p>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-head">
          <span className="sidebar-intro-label">workspace</span>
        </div>

        <button className="new-chat-btn" onClick={() => createSession()}>
          <span className="new-chat-btn-mark">+</span>
          <span>new thread</span>
        </button>

        <div className="sidebar-meta-grid">
          <div className="sidebar-meta-card">
            <span className="sidebar-meta-label">inference</span>
            <strong>SolRouter encrypted</strong>
          </div>
          <div className="sidebar-meta-card">
            <span className="sidebar-meta-label">wallet</span>
            <strong>read-only for now</strong>
          </div>
        </div>
      </div>

      <div className="session-list-head">
        <div className="session-list-label">recent sessions</div>
        <span className="session-count">{sessions.length}</span>
      </div>
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
        <span className="sidebar-footer-line">
          <span className="sidebar-footer-label">powered by</span>{" "}
          <a href="https://www.solrouter.com" target="_blank" rel="noopener noreferrer">
            SolRouter
          </a>
        </span>
        <span>Arcium TEE &middot; theme aware &middot; no plaintext logging</span>
      </div>
    </aside>
  );
}
