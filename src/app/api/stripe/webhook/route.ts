import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured, isStripeConfigured, serverEnv } from "@/lib/env";
import { getStripe } from "@/lib/billing/stripe";
import { syncSubscription } from "@/lib/billing/sync";
import { logError } from "@/lib/log";

export const maxDuration = 30;

const HANDLED = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
  "invoice.paid",
]);

/**
 * Webhook do Stripe ("webhook" = aviso que o Stripe envia ao nosso servidor
 * quando algo muda numa cobrança).
 * - A assinatura criptográfica do aviso é conferida antes de qualquer coisa.
 * - Cada aviso é processado uma única vez (o Stripe pode reenviar).
 * - O estado é sempre relido do Stripe, nunca do conteúdo do aviso antigo.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured() || !serverEnv.stripeWebhookSecret || !isServiceRoleConfigured()) {
    return Response.json({ error: "Pagamentos não configurados." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();
  if (!signature) return Response.json({ error: "Assinatura ausente." }, { status: 400 });

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, serverEnv.stripeWebhookSecret);
  } catch {
    return Response.json({ error: "Assinatura inválida." }, { status: 400 });
  }

  if (!HANDLED.has(event.type)) return Response.json({ received: true, ignored: true });

  const admin = createAdminClient();

  // Idempotência: se o aviso já foi registrado como processado, não repete.
  const { data: existing } = await admin
    .from("billing_events")
    .select("id, status")
    .eq("stripe_event_id", event.id)
    .maybeSingle();
  if (existing && existing.status !== "erro") {
    return Response.json({ received: true, duplicate: true });
  }

  try {
    const subscriptionId = subscriptionIdOf(event);
    let outcome: { status: "processado" | "ignorado"; userId: string | null; detail: string };
    if (!subscriptionId) {
      outcome = { status: "ignorado", userId: null, detail: "aviso sem assinatura" };
    } else {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      if (event.type === "checkout.session.completed") {
        // Vincula o cliente do Stripe ao usuário que iniciou o checkout.
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id ?? session.metadata?.user_id ?? null;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        if (userId && customerId && /^[0-9a-f-]{36}$/i.test(userId)) {
          await admin
            .from("subscriptions")
            .update({ stripe_customer_id: customerId })
            .eq("user_id", userId)
            .is("stripe_customer_id", null);
        }
      }
      outcome = await syncSubscription(admin, subscription);
    }

    await admin.from("billing_events").upsert(
      {
        stripe_event_id: event.id,
        type: event.type,
        user_id: outcome.userId,
        status: outcome.status,
        detail: outcome.detail.slice(0, 300),
      },
      { onConflict: "stripe_event_id" },
    );
    return Response.json({ received: true });
  } catch (error) {
    await logError("cobranca.webhook", error, event.type);
    await admin.from("billing_events").upsert(
      {
        stripe_event_id: event.id,
        type: event.type,
        status: "erro",
        detail: (error instanceof Error ? error.message : "erro").slice(0, 300),
      },
      { onConflict: "stripe_event_id" },
    );
    // 500 faz o Stripe tentar de novo mais tarde.
    return Response.json({ error: "Falha ao processar." }, { status: 500 });
  }
}

function subscriptionIdOf(event: Stripe.Event): string | null {
  const object = event.data.object as unknown as Record<string, unknown>;
  if (event.type.startsWith("customer.subscription.")) return typeof object.id === "string" ? object.id : null;
  if (event.type === "checkout.session.completed") {
    const sub = object.subscription;
    return typeof sub === "string" ? sub : ((sub as { id?: string } | null)?.id ?? null);
  }
  // Faturas: o vínculo com a assinatura mudou de lugar entre versões da API.
  const direct = object.subscription;
  if (typeof direct === "string") return direct;
  const parent = object.parent as { subscription_details?: { subscription?: string | { id?: string } } } | undefined;
  const nested = parent?.subscription_details?.subscription;
  if (typeof nested === "string") return nested;
  return nested?.id ?? null;
}
