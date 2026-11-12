"use client";

import { createContext, useContext } from "react";

/**
 * Goal colors for mention chips, keyed by mention id. Filled from the entry's
 * mentionColors (server) plus anything picked from the @ menu this session.
 * The node only stores { id, label, targetType }, so color lives here.
 */
export const MentionColorsContext = createContext<ReadonlyMap<string, string>>(new Map());

export function useMentionColor(id: string | null): string | null {
  const colors = useContext(MentionColorsContext);
  return id === null ? null : (colors.get(id) ?? null);
}
