import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isPlanId } from "@/lib/plans";
import type { UserContext } from "@/lib/types";

export type SessionUser = { id: string; email: string };

/**
 * Camada única de leitura da sessão. Toda página, ação e rota do servidor
 * passa por aqui antes de tocar em dados.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? "" };
});

export async function requireUser(): Promise<SessionUser> {
  if (!isSupabaseConfigured()) redirect("/configuracao-pendente");
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  return user;
}

export const getUserContext = cache(async (): Promise<UserContext | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_context");
  if (error || !data || !data.profile || !data.preferences) return null;
  return {
    email: user.email,
    profile: data.profile,
    preferences: data.preferences,
    plan: isPlanId(data.plan) ? data.plan : "gratuito",
    subscription: data.subscription ?? {
      plan: "gratuito",
      status: "active",
      current_period_end: null,
      cancel_at_period_end: false,
      has_customer: false,
    },
    family: data.family ?? null,
    flags: data.flags ?? {},
  };
});

/** Para páginas do app: exige login e o primeiro acesso concluído. */
export async function requireContext(options?: { allowOnboarding?: boolean }): Promise<UserContext> {
  await requireUser();
  const ctx = await getUserContext();
  if (!ctx) redirect("/entrar?erro=perfil");
  if (!options?.allowOnboarding && !ctx.profile.onboarding_completed_at) {
    redirect("/app/boas-vindas");
  }
  return ctx;
}

export async function requireAdmin(): Promise<UserContext> {
  const ctx = await requireContext();
  if (ctx.profile.role !== "admin") redirect("/app");
  return ctx;
}
