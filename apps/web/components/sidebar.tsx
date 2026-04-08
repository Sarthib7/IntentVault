"use client";

import { useSessions, useActiveSessionId } from "@/lib/use-session-store";
import { createSession, setActiveSession } from "@/lib/session-store";

const SAMPLE_FOLDERS = [
  "Work chats",
  "Life chats",
  "Projects chats",
  "Clients chats"
];

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 60_000) return "now";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function Sidebar() {
  const sessions = useSessions();
  const activeId = useActiveSessionId();

  return (
    <aside className="sidebar">
      <div className="sidebar-topbar">
        <div className="sidebar-brand">
          <div className="brand-mark">
            <span className="brand-cursor" />
          </div>
          <div className="sidebar-brand-copy">
            <span className="sidebar-kicker">intentvault</span>
            <h1>My Chats</h1>
          </div>
        </div>
        <div className="sidebar-tool" aria-hidden="true">
          {"\u2630"}
        </div>
      </div>

      <div className="sidebar-search">
        <div className="sidebar-search-box">
          <span className="sidebar-search-icon">{"\u2315"}</span>
          <span className="sidebar-search-placeholder">Search</span>
        </div>
      </div>

      <div className="sidebar-group">
        <div className="sidebar-group-label">Folders</div>
        <div className="sidebar-sample-list">
          {SAMPLE_FOLDERS.map((label) => (
            <div key={label} className="sidebar-sample-card" aria-hidden="true">
              <span className="sidebar-sample-accent" />
              <span className="sidebar-sample-name">{label}</span>
              <span className="sidebar-sample-more">{"\u2026"}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="session-list-head">
        <div className="session-list-label">chats</div>
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
        <button className="new-chat-btn" onClick={() => createSession()}>
          <span>New chat</span>
          <span className="new-chat-btn-mark">+</span>
        </button>
        <span className="sidebar-footer-note">SolRouter encrypted</span>
      </div>
    </aside>
  );
}
