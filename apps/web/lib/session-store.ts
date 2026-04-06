/**
 * In-memory session store. No localStorage, no persistence—
 * sessions live only for the duration of the browser tab.
 */

import type { ChatMessage, Session } from "@intentvault/schemas";

let sessions: Session[] = [];
let activeSessionId: string | null = null;
let listeners: Set<() => void> = new Set();

function notify() {
  for (const fn of listeners) fn();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSessions(): Session[] {
  return sessions;
}

export function getActiveSessionId(): string | null {
  return activeSessionId;
}

export function getActiveSession(): Session | null {
  if (!activeSessionId) return null;
  return sessions.find((s) => s.id === activeSessionId) ?? null;
}

export function createSession(title?: string): Session {
  const now = new Date().toISOString();
  const session: Session = {
    id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: title ?? "New investigation",
    createdAt: now,
    updatedAt: now,
    messages: []
  };
  sessions = [session, ...sessions];
  activeSessionId = session.id;
  notify();
  return session;
}

export function setActiveSession(id: string) {
  activeSessionId = id;
  notify();
}

export function addMessage(sessionId: string, message: ChatMessage) {
  sessions = sessions.map((s) => {
    if (s.id !== sessionId) return s;
    const title =
      s.messages.length === 0 && message.role === "user"
        ? message.content.slice(0, 60)
        : s.title;
    return {
      ...s,
      title,
      updatedAt: new Date().toISOString(),
      messages: [...s.messages, message]
    };
  });
  notify();
}

export function updateSessionTitle(sessionId: string, title: string) {
  sessions = sessions.map((s) =>
    s.id === sessionId ? { ...s, title } : s
  );
  notify();
}
