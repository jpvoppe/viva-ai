import type { ReactNode } from "react";
import { requireContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getAiSetup } from "@/lib/ai";
import { emptyUsage } from "@/lib/limits/usage-snapshot";
import { todayInTimeZone } from "@/lib/utils";
import type { QuotaKind } from "@/lib/plans";
import { AppContextProvider } from "./app-context";
import { AppShell } from "./app-shell";
import { AchievementsProvider } from "./achievements";

/**
 * Porta de entrada da área logada: confere a sessão no servidor,
 * carrega o contexto do usuário e só então desenha o app.
 */
export async function SessionGate({ children }: { children: ReactNode }) {
  const ctx = await requireContext({ allowOnboarding: true });
  const supabase = await createClient();
  const today = todayInTimeZone(ctx.profile.timezone);

  const [{ data: counters }, { data: recents }] = await Promise.all([
    supabase.from("usage_counters").select("kind, count").eq("period_start", today),
    supabase
      .from("conversations")
      .select("id, title, last_message_at")
      .order("last_message_at", { ascending: false })
      .limit(6),
  ]);

  const usage = emptyUsage(ctx.plan);
  for (const row of counters ?? []) {
    const kind = row.kind as QuotaKind;
    if (usage[kind]) usage[kind].used = row.count;
  }

  const ai = getAiSetup();

  return (
    <AppContextProvider
      ctx={ctx}
      initialUsage={usage}
      initialRecents={recents ?? []}
      aiConfigured={ai.configured}
      aiSimulated={ai.configured && ai.simulated}
    >
      <AchievementsProvider enabled={ctx.preferences.gamification_enabled}>
        <AppShell>{children}</AppShell>
      </AchievementsProvider>
    </AppContextProvider>
  );
}
