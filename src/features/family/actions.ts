"use server";

import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { fail, ok, requireActionContext, runAction } from "@/lib/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured, serverEnv } from "@/lib/env";
import { FAMILY_MAX_PEOPLE } from "@/lib/plans";
import { emailSchema } from "@/features/auth/schema";
import type { ActionResult } from "@/lib/types";

const INVITE_DAYS = 7;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type FamilyInvite = { id: string; email: string; expires_at: string };

/**
 * Cria um convite para o plano Família. O link só aparece uma vez (guardamos
 * apenas o hash) e só vale para o e-mail informado.
 */
export async function createFamilyInviteAction(input: unknown): Promise<ActionResult<{ invite: FamilyInvite; link: string }>> {
  return runAction("familia.convidar", z.object({ email: emailSchema }), input, async ({ email }, { user }) => {
    if (!isServiceRoleConfigured()) return fail("Configuração incompleta no servidor.");
    const ctx = await requireActionContext();
    if (!ctx) return fail("Sua sessão expirou. Entre de novo para continuar.");
    if (ctx.subscription.plan !== "familia" || !["active", "trialing", "past_due"].includes(ctx.subscription.status)) {
      return fail("Convites fazem parte do plano VIVA Família.");
    }
    if (email === user.email.toLowerCase()) return fail("Este é o seu próprio e-mail.");

    const admin = createAdminClient();
    const { data: family, error: familyError } = await admin
      .from("families")
      .upsert({ owner_id: user.id }, { onConflict: "owner_id" })
      .select("id")
      .single();
    if (familyError || !family) throw new Error(familyError?.message ?? "família não encontrada");

    const now = new Date().toISOString();
    const [{ count: members }, { count: pending }] = await Promise.all([
      admin.from("family_members").select("user_id", { count: "exact", head: true }).eq("family_id", family.id),
      admin
        .from("family_invites")
        .select("id", { count: "exact", head: true })
        .eq("family_id", family.id)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .gt("expires_at", now),
    ]);
    if (1 + (members ?? 0) + (pending ?? 0) >= FAMILY_MAX_PEOPLE) {
      return fail(`O plano Família comporta ${FAMILY_MAX_PEOPLE} pessoas, contando você e os convites em aberto.`);
    }

    const token = randomBytes(32).toString("base64url");
    const expires = new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString();
    const { data: invite, error } = await admin
      .from("family_invites")
      .insert({ family_id: family.id, email, token_hash: hashToken(token), expires_at: expires })
      .select("id, email, expires_at")
      .single();
    if (error || !invite) throw new Error(error?.message ?? "convite não criado");
    return ok({ invite: invite as FamilyInvite, link: `${serverEnv.siteUrl}/app/convite/${token}` });
  });
}

export async function revokeFamilyInviteAction(input: { id: string }): Promise<ActionResult> {
  return runAction("familia.revogar", z.object({ id: z.uuid() }), input, async ({ id }, { user }) => {
    const admin = createAdminClient();
    const { data: family } = await admin.from("families").select("id").eq("owner_id", user.id).maybeSingle();
    if (!family) return fail("Você não é responsável por uma família.");
    const { error } = await admin
      .from("family_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("family_id", family.id);
    if (error) throw new Error(error.message);
    return ok(undefined, "Convite cancelado.");
  });
}

export async function removeFamilyMemberAction(input: { user_id: string }): Promise<ActionResult> {
  return runAction("familia.remover", z.object({ user_id: z.uuid() }), input, async ({ user_id }, { user }) => {
    const admin = createAdminClient();
    const { data: family } = await admin.from("families").select("id").eq("owner_id", user.id).maybeSingle();
    if (!family) return fail("Você não é responsável por uma família.");
    const { error } = await admin.from("family_members").delete().eq("family_id", family.id).eq("user_id", user_id);
    if (error) throw new Error(error.message);
    return ok(undefined, "Pessoa removida da família. Os dados dela continuam privados e intactos.");
  });
}

export async function leaveFamilyAction(): Promise<ActionResult> {
  return runAction("familia.sair", z.object({}), {}, async (_data, { user }) => {
    const { error } = await createAdminClient().from("family_members").delete().eq("user_id", user.id);
    if (error) throw new Error(error.message);
    return ok(undefined, "Você saiu da família e voltou ao plano Gratuito.");
  });
}

/** Aceita um convite. Só funciona logado com o mesmo e-mail que recebeu o convite. */
export async function acceptFamilyInviteAction(input: { token: string }): Promise<ActionResult> {
  return runAction(
    "familia.aceitar",
    z.object({ token: z.string().min(20).max(100) }),
    input,
    async ({ token }, { user }) => {
      if (!isServiceRoleConfigured()) return fail("Configuração incompleta no servidor.");
      const ctx = await requireActionContext();
      if (!ctx) return fail("Sua sessão expirou. Entre de novo para continuar.");
      const admin = createAdminClient();
      const invalid = "Este convite não é válido, expirou ou já foi usado. Peça um novo a quem convidou.";

      const { data: invite } = await admin
        .from("family_invites")
        .select("id, family_id, email, expires_at, accepted_at, revoked_at")
        .eq("token_hash", hashToken(token))
        .maybeSingle();
      if (!invite || invite.accepted_at || invite.revoked_at || invite.expires_at < new Date().toISOString()) {
        return fail(invalid);
      }
      if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
        return fail("Este convite foi enviado para outro e-mail. Entre com a conta do e-mail convidado.");
      }
      if (ctx.family) return fail("Você já faz parte de uma família no VIVA.");
      if (ctx.subscription.plan !== "gratuito" && ctx.subscription.status !== "canceled") {
        return fail("Você já tem uma assinatura própria. Cancele-a antes de entrar em um plano Família.");
      }

      const { data: family } = await admin.from("families").select("id, owner_id").eq("id", invite.family_id).maybeSingle();
      if (!family) return fail(invalid);
      const { data: ownerSub } = await admin.from("subscriptions").select("plan, status").eq("user_id", family.owner_id).maybeSingle();
      if (!ownerSub || ownerSub.plan !== "familia" || !["active", "trialing", "past_due"].includes(ownerSub.status)) {
        return fail("O plano Família de quem convidou não está mais ativo.");
      }
      const { count } = await admin.from("family_members").select("user_id", { count: "exact", head: true }).eq("family_id", family.id);
      if (1 + (count ?? 0) >= FAMILY_MAX_PEOPLE) return fail("Esta família já está completa.");

      const { error } = await admin.from("family_members").insert({ family_id: family.id, user_id: user.id });
      if (error) {
        if (error.code === "23505") return fail("Você já faz parte de uma família no VIVA.");
        throw new Error(error.message);
      }
      await admin
        .from("family_invites")
        .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
        .eq("id", invite.id);
      return ok(undefined, "Você entrou no plano Família.");
    },
  );
}
