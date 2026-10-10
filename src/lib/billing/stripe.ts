import "server-only";
import Stripe from "stripe";
import { serverEnv } from "@/lib/env";
import type { PlanId } from "@/lib/plans";

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (client) return client;
  const key = serverEnv.stripeSecretKey;
  if (!key) throw new Error("Stripe não configurado");
  // STRIPE_API_HOST existe só para os testes automatizados (servidor falso local) e
  // é ignorado com chave de produção.
  const testHost = key.startsWith("sk_test_") ? process.env.STRIPE_API_HOST : undefined;
  client = new Stripe(key, {
    maxNetworkRetries: testHost ? 0 : 2,
    timeout: 20_000,
    appInfo: { name: "VIVA AI" },
    ...(testHost
      ? { host: testHost.split(":")[0], port: Number(testHost.split(":")[1] ?? 80), protocol: "http" as const }
      : {}),
  });
  return client;
}

export function isTestMode(): boolean {
  return Boolean(serverEnv.stripeSecretKey?.startsWith("sk_test_"));
}

export function priceIdForPlan(plan: PlanId): string | null {
  if (plan === "plus") return serverEnv.stripePricePlus ?? null;
  if (plan === "familia") return serverEnv.stripePriceFamilia ?? null;
  return null;
}

/** Qual plano um preço do Stripe representa. Preço desconhecido não libera nada. */
export function planForPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId === serverEnv.stripePricePlus) return "plus";
  if (priceId === serverEnv.stripePriceFamilia) return "familia";
  return null;
}
