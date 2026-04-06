"use client";

import { useSessions, useActiveSessionId } from "@/lib/use-session-store";
import { createSession, setActiveSession } from "@/lib/session-store";

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 60_000) return "just now";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function Sidebar() {
  const sessions = useSessions();
  const activeId = useActiveSessionId();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>IntentVault</h1>
        <span className="network-badge">Devnet</span>
      </div>

      <button className="new-chat-btn" onClick={() => createSession()}>
        + New Investigation
      </button>

      <div className="session-list">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`session-item ${session.id === activeId ? "active" : ""}`}
            onClick={() => setActiveSession(session.id)}
          >
            <span className="session-item-title">{session.title}</span>
            <span className="session-item-time">
              {formatTime(session.updatedAt)}
            </span>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <span>Private Solana decision workflows</span>
        <span>No server-side history &middot; No wallet signing</span>
        <span>
          Powered by{" "}
          <a
            href="https://www.solrouter.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            SolRouter
          </a>
        </span>
      </div>
    </aside>
  );
}
