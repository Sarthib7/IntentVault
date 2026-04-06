"use client";

import { useSyncExternalStore, useCallback } from "react";
import {
  subscribe,
  getSessions,
  getActiveSessionId,
  getActiveSession
} from "./session-store";
import type { Session } from "@intentvault/schemas";

export function useSessions(): Session[] {
  return useSyncExternalStore(subscribe, getSessions, getSessions);
}

export function useActiveSessionId(): string | null {
  return useSyncExternalStore(subscribe, getActiveSessionId, getActiveSessionId);
}

export function useActiveSession(): Session | null {
  return useSyncExternalStore(subscribe, getActiveSession, getActiveSession);
}
