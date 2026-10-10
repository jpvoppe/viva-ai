"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, requireActionContext, runAction } from "@/lib/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured, isStripeConfigured } from "@/lib/env";
import { ageBandFor, ageOn, MIN_AGE } from "@/features/auth/schema";
import { ATTACHMENTS_BUCKET } from "@/lib/files/storage";
import { logError } from "@/lib/log";
import type { ActionResult } from "@/lib/types";
import { GOAL_IDS } from "./options";

const preferencesSchema = z
  .object({
    theme: z.enum(["sistema", "claro", "escuro"]),
    response_style: z.enum(["direto", "equilibrado", "detalhado"]),
    goals: z.array(z.enum(GOAL_IDS)).max(6),
    enter_to_send: z.boolean(),
    gamification_enabled: z.boolean(),
    voice_reply: z.boolean(),
    weekly_task_goal: z.union([z.null(), z.coerce.number().int().min(1, "Use um número de 1 a 100.").max(100, "Use um número de 1 a 100.")]),
  })
  .partial();

export async function updatePreferencesAction(input: unknown): Promise<ActionResult> {
  return runAction("preferencias.salvar", preferencesSchema, input, async (data, { supabase, user }) => {
    if (Object.keys(data).length === 0) return ok();
    const { error } = await supabase.from("user_preferences").update(data).eq("user_id", user.id);
    if (error) throw new Error(error.message);
    return ok(undefined, "Preferências salvas.");
  });
}

const profileSchema = z.object({
  display_name: z.string().trim().min(2, "Informe como quer ser chamado.").max(80, "Nome muito longo."),
});

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  return runAction("perfil.salvar", profileSchema, input, async (data, { supabase, user }) => {
    const { error } = await supabase.from("profiles").update(data).eq("id", user.id);
    if (error) throw new Error(error.message);
    return ok(undefined, "Nome atualizado.");
  });
}

const onboardingSchema = z.object({
  goals: z.array(z.enum(GOAL_IDS)).max(6).default([]),
  theme: z.enum(["sistema", "claro", "escuro"]).default("sistema"),
  response_style: z.enum(["direto", "equilibrado", "detalhado"]).default("equilibrado"),
  memory_enabled: z.boolean().default(false),
  timezone: z.string().max(64).optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** Conclui o primeiro acesso. Tudo aqui é opcional: pular grava os valores padrão. */
export async function completeOnboardingAction(input: unknown): Promise<ActionResult> {
  return runAction("boas_vindas.concluir", onboardingSchema, input, async (data, { supabase, user }) => {
    const ctx = await requireActionContext();
    if (!ctx) return fail("Sua sessão expirou. Entre de novo para continuar.");

    // Conta criada sem faixa etária (ex.: fora do formulário): exige agora.
    if (!ctx.profile.age_band) {
      const age = data.birthDate ? ageOn(data.birthDate) : null;
      const band = age === null ? null : ageBandFor(age);
      if (age === null) return { ok: false, error: "Informe a sua data de nascimento.", fieldErrors: { birthDate: "Informe a sua data de nascimento." } };
      if (!band) return fail(`O VIVA é para pessoas a partir de ${MIN_AGE} anos.`);
      if (!isServiceRoleConfigured()) return fail("Configuração incompleta no servidor. Fale com o suporte.");
      const { error } = await createAdminClient().from("profiles").update({ age_band: band }).eq("id", user.id).is("age_band", null);
      if (error) throw new Error(error.message);
    }

    const { error: prefError } = await supabase
      .from("user_preferences")
      .update({
        goals: data.goals,
        theme: data.theme,
        response_style: data.response_style,
        memory_enabled: data.memory_enabled,
        ...(data.memory_enabled ? { memory_consent_at: new Date().toISOString() } : {}),
      })
      .eq("user_id", user.id);
    if (prefError) throw new Error(prefError.message);

    const { error } = await supabase
      .from("profiles")
      .update({ onboarding_completed_at: new Date().toISOString(), ...(data.timezone ? { timezone: data.timezone } : {}) })
      .eq("id", user.id);
    if (error) {
      // Fuso inválido não pode impedir a entrada: tenta sem ele.
      const retry = await supabase.from("profiles").update({ onboarding_completed_at: new Date().toISOString() }).eq("id", user.id);
      if (retry.error) throw new Error(retry.error.message);
    }
    return ok();
  });
}

const feedbackSchema = z.object({
  category: z.enum(["geral", "problema", "sugestao"]).default("geral"),
  comment: z.string().trim().min(5, "Escreva um pouco mais para a gente entender.").max(2000, "Use até 2.000 caracteres."),
});

export async function sendFeedbackAction(input: unknown): Promise<ActionResult> {
  return runAction("feedback.enviar", feedbackSchema, input, async (data, { supabase }) => {
    const { error } = await supabase.from("feedback").insert(data);
    if (error) throw new Error(error.message);
    return ok(undefined, "Recebido. Obrigado por ajudar a melhorar o VIVA.");
  });
}

/**
 * Exclusão definitiva da conta e de todos os dados (LGPD, art. 18).
 * Ordem: cancela a assinatura → apaga os arquivos → apaga o usuário
 * (o banco apaga em cascata tudo que pertence a ele).
 */
export async function deleteAccountAction(input: unknown): Promise<ActionResult> {
  const result = await runAction(
    "conta.excluir",
    z.object({ confirmation: z.literal("EXCLUIR", { error: "Digite EXCLUIR para confirmar." }) }),
    input,
    async (_data, { supabase, user }) => {
      if (!isServiceRoleConfigured()) {
        return fail("A exclusão de conta não está configurada neste ambiente. Fale com o suporte.");
      }
      const admin = createAdminClient();

      const { data: subscription } = await admin
        .from("subscriptions")
        .select("stripe_subscription_id, status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (subscription?.stripe_subscription_id && isStripeConfigured()) {
        try {
          const { getStripe } = await import("@/lib/billing/stripe");
          await getStripe().subscriptions.cancel(subscription.stripe_subscription_id);
        } catch (error) {
          await logError("conta.excluir.assinatura", error);
          return fail("Não foi possível cancelar a sua assinatura agora. Tente de novo em instantes; nada foi apagado.");
        }
      }

      const { data: files } = await supabase.from("files").select("storage_path").limit(1000);
      if (files && files.length > 0) {
        await admin.storage.from(ATTACHMENTS_BUCKET).remove(files.map((f) => f.storage_path));
      }

      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error) throw new Error(error.message);
      await supabase.auth.signOut();
      return ok();
    },
  );
  if (result.ok) redirect("/?conta=excluida");
  return result;
}
