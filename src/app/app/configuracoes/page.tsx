import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { SettingsClient, type SettingsData } from "@/features/settings/settings-client";
import type { FamilyInvite } from "@/features/family/actions";
import type { Memory } from "@/features/memory/actions";
import { requireContext } from "@/lib/auth/session";
import { getPlanPrices } from "@/lib/billing/prices";
import { createClient } from "@/lib/supabase/server";
import type { Stats } from "@/lib/types";
import Loading from "../loading";

export const metadata: Metadata = { title: "Configurações" };

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const now = new Date().toISOString();

  const [memories, stats, unlocked, prices, roster, invites] = await Promise.all([
    supabase.from("memories").select("id, content, created_at").order("created_at", { ascending: false }).limit(200),
    ctx.preferences.gamification_enabled ? supabase.rpc("my_stats") : Promise.resolve({ data: null }),
    supabase.from("user_achievements").select("code, unlocked_at"),
    getPlanPrices(),
    ctx.family ? supabase.rpc("family_roster") : Promise.resolve({ data: [] }),
    ctx.family?.is_owner
      ? supabase
          .from("family_invites")
          .select("id, email, expires_at")
          .is("accepted_at", null)
          .is("revoked_at", null)
          .gt("expires_at", now)
      : Promise.resolve({ data: [] }),
  ]);

  const data: SettingsData = {
    memories: (memories.data ?? []) as Memory[],
    stats: (stats.data ?? null) as Stats | null,
    unlocked: unlocked.data ?? [],
    prices,
    roster: (roster.data ?? []) as SettingsData["roster"],
    invites: (invites.data ?? []) as FamilyInvite[],
  };

  return (
    <PageContainer wide>
      <PageHeader title="Configurações" />
      <SettingsClient data={data} />
    </PageContainer>
  );
}
