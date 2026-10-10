"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useServerState } from "@/hooks/use-server-state";
import type { ConversationSummary, Preferences, UserContext } from "@/lib/types";
import type { UsageSnapshot } from "@/lib/limits/usage-snapshot";
import type { QuotaKind } from "@/lib/plans";

type AppContextValue = {
  ctx: UserContext;
  usage: UsageSnapshot;
  /** Atualiza o contador mostrado na tela com o valor que o servidor devolveu. */
  setUsage: (kind: QuotaKind, used: number, limit: number) => void;
  aiSimulated: boolean;
  aiConfigured: boolean;
  /** Conversas recentes do menu lateral, mantidas em dia sem recarregar a página. */
  recents: ConversationSummary[];
  touchRecent: (conversation: { id: string; title: string }) => void;
  removeRecent: (id: string) => void;
  /**
   * Reflete na tela inteira uma preferência ou nome que acabou de ser salvo,
   * sem recarregar a página (o servidor já gravou).
   */
  patchContext: (patch: { preferences?: Partial<Preferences>; displayName?: string }) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppContextProvider({
  ctx: serverCtx,
  initialUsage,
  initialRecents,
  aiSimulated,
  aiConfigured,
  children,
}: {
  ctx: UserContext;
  initialUsage: UsageSnapshot;
  initialRecents: ConversationSummary[];
  aiSimulated: boolean;
  aiConfigured: boolean;
  children: ReactNode;
}) {
  const [ctx, setCtx] = useServerState(serverCtx);
  const patchContext = useCallback(
    (patch: { preferences?: Partial<Preferences>; displayName?: string }) => {
      setCtx((current) => ({
        ...current,
        preferences: { ...current.preferences, ...patch.preferences },
        profile: patch.displayName === undefined ? current.profile : { ...current.profile, display_name: patch.displayName },
      }));
    },
    [setCtx],
  );
  const [usage, setUsageState] = useServerState(initialUsage);
  const setUsage = useCallback((kind: QuotaKind, used: number, limit: number) => {
    setUsageState((current) => ({ ...current, [kind]: { used, limit } }));
  }, [setUsageState]);
  const [recents, setRecents] = useServerState(initialRecents);
  const touchRecent = useCallback((conversation: { id: string; title: string }) => {
    setRecents((current) =>
      [
        { ...conversation, last_message_at: new Date().toISOString() },
        ...current.filter((c) => c.id !== conversation.id),
      ].slice(0, 6),
    );
  }, [setRecents]);
  const removeRecent = useCallback((id: string) => {
    setRecents((current) => current.filter((c) => c.id !== id));
  }, [setRecents]);
  const value = useMemo(
    () => ({ ctx, usage, setUsage, aiSimulated, aiConfigured, recents, touchRecent, removeRecent, patchContext }),
    [ctx, usage, setUsage, aiSimulated, aiConfigured, recents, touchRecent, removeRecent, patchContext],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp precisa estar dentro de AppContextProvider");
  return value;
}
