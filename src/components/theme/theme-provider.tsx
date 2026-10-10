"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import type { ThemePreference } from "@/lib/types";

type ThemeContextValue = {
  /** O que o usuário escolheu: sistema, claro ou escuro. */
  preference: ThemePreference;
  /** O que está na tela agora. */
  resolved: "claro" | "escuro";
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const listeners = new Set<() => void>();
function subscribe(callback: () => void) {
  listeners.add(callback);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    media.removeEventListener("change", callback);
    window.removeEventListener("storage", callback);
  };
}

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "claro" || stored === "escuro" ? stored : "sistema";
  } catch {
    return "sistema";
  }
}

function getSnapshot(): string {
  const preference = readPreference();
  const system = window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
  return `${preference}|${preference === "sistema" ? system : preference}`;
}

function getServerSnapshot(): string {
  return "sistema|claro";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [preference, resolved] = snapshot.split("|") as [ThemePreference, "claro" | "escuro"];

  useEffect(() => {
    document.documentElement.dataset.theme = resolved === "escuro" ? "dark" : "light";
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute("content", resolved === "escuro" ? "#15131c" : "#fbfafd");
  }, [resolved]);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      if (next === "sistema") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Sem armazenamento local (modo privado): o tema vale só nesta visita.
    }
    for (const listener of listeners) listener();
  }, []);

  const value = useMemo(() => ({ preference, resolved, setPreference }), [preference, resolved, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme precisa estar dentro de ThemeProvider");
  return ctx;
}
