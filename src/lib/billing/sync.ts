import "server-only";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { planForPriceId } from "./stripe";

const KNOWN_STATUS = [
  "active", "trialing", "past_due", "canceled", "incomplete", "incomplete_expired", "unpaid", "paused",
] as const;

export type SyncOutcome = { status: "processado" | "ignorado"; userId: string | null; detail: string };

/**
 * Espelha no banco o estado de uma assinatura do Stripe.
 * É a ÚNICA forma de um plano pago ser concedido: o retorno do navegador
 * depois do pagamento não concede nada.
 */
export async function syncSubscription(
  admin: SupabaseClient,
  subscription: Stripe.Subscription,
): Promise<SyncOutcome> {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  // Quem é o dono: primeiro pelo cliente já vinculado; depois pelo metadado gravado no checkout.
  let userId: string | null = null;
  const { data: byCustomer } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  userId = byCustomer?.user_id ?? null;
  if (!userId) {
    const candidate = subscription.metadata?.user_id;
    if (candidate && /^[0-9a-f-]{36}$/i.test(candidate)) {
      const { data: exists } = await admin.from("subscriptions").select("user_id").eq("user_id", candidate).maybeSingle();
      userId = exists?.user_id ?? null;
    }
  }
  if (!userId) return { status: "ignorado", userId: null, detail: "assinatura sem usuário correspondente" };

  const item = subscription.items.data[0];
  const plan = planForPriceId(item?.price?.id);
  const status = KNOWN_STATUS.find((s) => s === subscription.status) ?? "incomplete";
  const ended = status === "canceled" || status === "incomplete_expired";

  if (!plan && !ended) {
    return { status: "ignorado", userId, detail: `preço não reconhecido: ${item?.price?.id ?? "?"}` };
  }

  const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null;

  const { error } = await admin
    .from("subscriptions")
    .update(
      ended
        ? {
            plan: "gratuito",
            status: "active",
            stripe_customer_id: customerId,
            stripe_subscription_id: null,
            current_period_end: null,
            cancel_at_period_end: false,
          }
        : {
            plan,
            status,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription.id,
            current_period_end: periodEnd,
            cancel_at_period_end: subscription.cancel_at_period_end,
          },
    )
    .eq("user_id", userId);
  if (error) throw new Error(error.message);

  if (!ended && plan === "familia") {
    await admin.from("families").upsert({ owner_id: userId }, { onConflict: "owner_id", ignoreDuplicates: true });
  }

  return {
    status: "processado",
    userId,
    detail: ended ? "assinatura encerrada → gratuito" : `${plan} (${status})`,
  };
}
