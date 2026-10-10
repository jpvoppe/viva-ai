import http from "node:http";
import type { AddressInfo } from "node:net";
import Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, createTestUser, deleteTestUsers, hasTestDatabase, type TestUser } from "../helpers/supabase";

/**
 * Webhook de cobrança, de ponta a ponta no servidor:
 * a rota real do app + o banco de teste + um servidor que imita a API do Stripe.
 * Nenhuma cobrança real acontece e nada sai para a internet.
 */
const WEBHOOK_SECRET = "whsec_teste_local";
const PRICE_PLUS = "price_plus_teste";
const PRICE_FAMILIA = "price_familia_teste";

describe.skipIf(!hasTestDatabase)("webhook do Stripe", () => {
  const admin = adminClient();
  const stripe = new Stripe("sk_test_assinador");
  const subscriptions = new Map<string, Record<string, unknown>>();
  let fakeStripe: http.Server;
  let user: TestUser;
  let POST: (request: Request) => Promise<Response>;
  let counter = 0;

  beforeAll(async () => {
    fakeStripe = http.createServer((req, res) => {
      const match = /^\/v1\/subscriptions\/([\w]+)/.exec(req.url ?? "");
      const found = match ? subscriptions.get(match[1]) : undefined;
      res.setHeader("content-type", "application/json");
      if (!found) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: { type: "invalid_request_error", message: "No such subscription" } }));
        return;
      }
      res.end(JSON.stringify(found));
    });
    await new Promise<void>((resolve) => fakeStripe.listen(0, "127.0.0.1", resolve));

    process.env.STRIPE_SECRET_KEY = "sk_test_local";
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.STRIPE_PRICE_PLUS = PRICE_PLUS;
    process.env.STRIPE_PRICE_FAMILIA = PRICE_FAMILIA;
    process.env.STRIPE_API_HOST = `127.0.0.1:${(fakeStripe.address() as AddressInfo).port}`;

    ({ POST } = await import("@/app/api/stripe/webhook/route"));
    user = await createTestUser("assinante");
  });

  afterAll(async () => {
    await admin.from("billing_events").delete().like("stripe_event_id", "evt_teste_%");
    await deleteTestUsers();
    await new Promise((resolve) => fakeStripe.close(resolve));
  });

  function subscription(id: string, overrides: Record<string, unknown> = {}) {
    const object = {
      id,
      object: "subscription",
      customer: `cus_${user.id.slice(0, 8)}`,
      status: "active",
      cancel_at_period_end: false,
      metadata: { user_id: user.id },
      items: { object: "list", data: [{ id: "si_1", price: { id: PRICE_PLUS }, current_period_end: 1_900_000_000 }] },
      ...overrides,
    };
    subscriptions.set(id, object);
    return object;
  }

  async function send(type: string, object: Record<string, unknown>, options: { secret?: string; id?: string } = {}) {
    const id = options.id ?? `evt_teste_${Date.now()}_${counter++}`;
    const payload = JSON.stringify({ id, object: "event", type, api_version: "2026-09-30", data: { object } });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: options.secret ?? WEBHOOK_SECRET });
    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": header } }),
    );
    return { id, status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  const currentRow = async () =>
    (await admin.from("subscriptions").select("plan, status, stripe_customer_id, stripe_subscription_id, cancel_at_period_end, current_period_end").eq("user_id", user.id).single()).data!;

  it("recusa aviso sem assinatura ou com assinatura falsa, e nada muda", async () => {
    const missing = await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: "{}" }));
    expect(missing.status).toBe(400);

    const forged = await send("customer.subscription.updated", subscription("sub_forjada"), { secret: "whsec_outro" });
    expect(forged.status).toBe(400);
    expect((await currentRow()).plan).toBe("gratuito");
  });

  it("o retorno do navegador não concede nada: só o aviso verificado ativa o plano", async () => {
    expect((await user.client.rpc("my_plan")).data).toBe("gratuito");

    const sub = subscription("sub_checkout");
    const result = await send("checkout.session.completed", {
      id: "cs_test_1",
      object: "checkout.session",
      client_reference_id: user.id,
      customer: sub.customer,
      subscription: sub.id,
      metadata: { user_id: user.id },
    });
    expect(result.status).toBe(200);

    const row = await currentRow();
    expect(row).toMatchObject({ plan: "plus", status: "active", stripe_subscription_id: "sub_checkout", cancel_at_period_end: false });
    expect(row.stripe_customer_id).toBe(sub.customer);
    expect(new Date(row.current_period_end).getTime()).toBe(1_900_000_000_000);
    expect((await user.client.rpc("my_plan")).data).toBe("plus");

    const { data: event } = await admin.from("billing_events").select("status, user_id, detail").eq("stripe_event_id", result.id).single();
    expect(event).toMatchObject({ status: "processado", user_id: user.id, detail: "plus (active)" });
  });

  it("aviso repetido é ignorado (o Stripe reenvia; não pode processar duas vezes)", async () => {
    const sub = subscription("sub_checkout");
    const first = await send("customer.subscription.updated", sub, { id: "evt_teste_repetido" });
    expect(first.body.duplicate).toBeUndefined();
    const again = await send("customer.subscription.updated", sub, { id: "evt_teste_repetido" });
    expect(again.status).toBe(200);
    expect(again.body.duplicate).toBe(true);
    const { data } = await admin.from("billing_events").select("id").eq("stripe_event_id", "evt_teste_repetido");
    expect(data).toHaveLength(1);
  });

  it("usa o estado atual do Stripe, não o conteúdo (possivelmente antigo) do aviso", async () => {
    // O aviso diz "active", mas no Stripe a assinatura já está com pagamento pendente.
    const stale = { ...subscription("sub_checkout"), status: "active" };
    subscription("sub_checkout", { status: "past_due" });
    await send("customer.subscription.updated", stale);
    expect((await currentRow()).status).toBe("past_due");
    // Pagamento pendente mantém o acesso enquanto o Stripe tenta de novo.
    expect((await user.client.rpc("my_plan")).data).toBe("plus");
  });

  it("falha de pagamento e cancelamento agendado são refletidos", async () => {
    subscription("sub_checkout", { status: "active", cancel_at_period_end: true });
    await send("invoice.payment_failed", { id: "in_1", object: "invoice", parent: { subscription_details: { subscription: "sub_checkout" } } });
    expect(await currentRow()).toMatchObject({ plan: "plus", status: "active", cancel_at_period_end: true });
  });

  it("troca para o plano Família cria a família do responsável", async () => {
    subscription("sub_checkout", { items: { object: "list", data: [{ id: "si_1", price: { id: PRICE_FAMILIA }, current_period_end: 1_900_000_000 }] } });
    await send("customer.subscription.updated", subscriptions.get("sub_checkout")!);
    expect((await currentRow()).plan).toBe("familia");
    const { data: family } = await admin.from("families").select("owner_id").eq("owner_id", user.id);
    expect(family).toHaveLength(1);
  });

  it("preço desconhecido não libera plano nenhum", async () => {
    const other = await createTestUser("preco-estranho");
    const sub = {
      id: "sub_estranha",
      object: "subscription",
      customer: "cus_estranho",
      status: "active",
      cancel_at_period_end: false,
      metadata: { user_id: other.id },
      items: { object: "list", data: [{ id: "si_x", price: { id: "price_que_nao_e_nosso" }, current_period_end: 1_900_000_000 }] },
    };
    subscriptions.set(sub.id, sub);
    const result = await send("customer.subscription.created", sub);
    expect(result.status).toBe(200);
    expect((await other.client.rpc("my_plan")).data).toBe("gratuito");
    const { data: event } = await admin.from("billing_events").select("status").eq("stripe_event_id", result.id).single();
    expect(event?.status).toBe("ignorado");
  });

  it("metadado apontando para um usuário inexistente não afeta ninguém", async () => {
    const sub = {
      id: "sub_orfa",
      object: "subscription",
      customer: "cus_orfao",
      status: "active",
      cancel_at_period_end: false,
      metadata: { user_id: "00000000-0000-4000-8000-000000000000" },
      items: { object: "list", data: [{ id: "si_y", price: { id: PRICE_PLUS }, current_period_end: 1_900_000_000 }] },
    };
    subscriptions.set(sub.id, sub);
    const result = await send("customer.subscription.created", sub);
    expect(result.status).toBe(200);
    const { data: event } = await admin.from("billing_events").select("status, user_id").eq("stripe_event_id", result.id).single();
    expect(event).toMatchObject({ status: "ignorado", user_id: null });
  });

  it("assinatura encerrada devolve a conta ao plano gratuito, sem apagar dados", async () => {
    await user.client.from("projects").insert({ name: "Projeto que deve sobreviver" });
    subscription("sub_checkout", { status: "canceled" });
    await send("customer.subscription.deleted", subscriptions.get("sub_checkout")!);
    expect(await currentRow()).toMatchObject({ plan: "gratuito", status: "active", stripe_subscription_id: null });
    expect((await user.client.rpc("my_plan")).data).toBe("gratuito");
    expect((await user.client.from("projects").select("id")).data).toHaveLength(1);
  });

  it("quando o Stripe está fora do ar, responde 500 (para o Stripe reenviar) e registra o erro", async () => {
    const result = await send("customer.subscription.updated", { id: "sub_inexistente", object: "subscription" });
    expect(result.status).toBe(500);
    const { data: event } = await admin.from("billing_events").select("status").eq("stripe_event_id", result.id).single();
    expect(event?.status).toBe("erro");
    // Um reenvio do mesmo aviso é processado de novo (não fica preso como "duplicado").
    subscription("sub_inexistente", { metadata: {}, customer: "cus_sem_dono" });
    const retry = await send("customer.subscription.updated", subscriptions.get("sub_inexistente")!, { id: result.id });
    expect(retry.status).toBe(200);
    expect(retry.body.duplicate).toBeUndefined();
  });

  it("tipos de aviso que não usamos são aceitos sem efeito", async () => {
    const result = await send("customer.created", { id: "cus_x", object: "customer" });
    expect(result).toMatchObject({ status: 200, body: { received: true, ignored: true } });
  });
});
