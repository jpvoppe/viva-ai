"use server";

import { z } from "zod";
import { fail, ok, requireActionContext, runAction } from "@/lib/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured, isStripeConfigured, serverEnv } from "@/lib/env";
import { getStripe, priceIdForPlan } from "@/lib/billing/stripe";
import type { ActionResult } from "@/lib/types";

const NOT_CONFIGURED =
  "Os pagamentos ainda não foram ativados neste ambiente. Nenhuma cobrança é feita enquanto isso.";

/** Abre o checkout seguro do Stripe para assinar um plano. */
export async function startCheckoutAction(input: unknown): Promise<ActionResult<{ url: string }>> {
  return runAction(
    "cobranca.checkout",
    z.object({ plan: z.enum(["plus", "familia"]) }),
    input,
    async ({ plan }, { user }) => {
      if (!isStripeConfigured() || !isServiceRoleConfigured()) return fail(NOT_CONFIGURED);
      const priceId = priceIdForPlan(plan);
      if (!priceId) return fail(NOT_CONFIGURED);

      const ctx = await requireActionContext();
      if (!ctx) return fail("Sua sessão expirou. Entre de novo para continuar.");
      if (ctx.profile.age_band !== "adulto") {
        return fail("Assinaturas só podem ser contratadas por maiores de 18 anos. Peça a um responsável.");
      }
      if (ctx.subscription.plan !== "gratuito" && ctx.subscription.status !== "canceled") {
        return fail("Você já tem uma assinatura. Use “Gerenciar assinatura” para trocar de plano.");
      }
      if (ctx.family && !ctx.family.is_owner) {
        return fail("Você já faz parte de um plano Família. Saia da família antes de assinar outro plano.");
      }

      const stripe = getStripe();
      const admin = createAdminClient();
      const { data: row } = await admin
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .maybeSingle();

      let customerId = row?.stripe_customer_id ?? null;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          name: ctx.profile.display_name || undefined,
          metadata: { user_id: user.id },
        });
        customerId = customer.id;
        await admin.from("subscriptions").update({ stripe_customer_id: customerId }).eq("user_id", user.id);
      }

      const base = serverEnv.siteUrl;
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        client_reference_id: user.id,
        line_items: [{ price: priceId, quantity: 1 }],
        locale: "pt-BR",
        allow_promotion_codes: true,
        success_url: `${base}/app/configuracoes?aba=assinatura&checkout=sucesso`,
        cancel_url: `${base}/app/configuracoes?aba=assinatura&checkout=cancelado`,
        metadata: { user_id: user.id, plan },
        subscription_data: { metadata: { user_id: user.id, plan } },
      });
      if (!session.url) throw new Error("checkout sem URL");
      return ok({ url: session.url });
    },
  );
}

/** Abre o portal do Stripe: trocar cartão, mudar de plano, cancelar, ver faturas. */
export async function openBillingPortalAction(): Promise<ActionResult<{ url: string }>> {
  return runAction("cobranca.portal", z.object({}), {}, async (_data, { user }) => {
    if (!isStripeConfigured() || !isServiceRoleConfigured()) return fail(NOT_CONFIGURED);
    const admin = createAdminClient();
    const { data: row } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!row?.stripe_customer_id) return fail("Você ainda não tem uma assinatura para gerenciar.");
    const session = await getStripe().billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: `${serverEnv.siteUrl}/app/configuracoes?aba=assinatura`,
      locale: "pt-BR",
    });
    return ok({ url: session.url });
  });
}
