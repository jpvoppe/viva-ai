import "server-only";
import { cacheLife } from "next/cache";
import { serverEnv } from "@/lib/env";
import { getStripe } from "./stripe";

export type PlanPrices = { plus: string | null; familia: string | null; configured: boolean; testMode: boolean };

const INTERVAL: Record<string, string> = { day: "dia", week: "semana", month: "mês", year: "ano" };

async function fetchPriceLabel(priceId: string): Promise<string> {
  "use cache";
  cacheLife("hours");
  const price = await getStripe().prices.retrieve(priceId);
  if (price.unit_amount === null || !price.currency) throw new Error("preço sem valor");
  const amount = new Intl.NumberFormat("pt-BR", { style: "currency", currency: price.currency.toUpperCase() }).format(
    price.unit_amount / 100,
  );
  const interval = price.recurring ? INTERVAL[price.recurring.interval] ?? price.recurring.interval : null;
  return interval ? `${amount} por ${interval}` : amount;
}

/**
 * Preços exibidos nas telas: vêm SEMPRE do Stripe (fonte única de preço).
 * Sem Stripe configurado, ou em caso de falha, devolve null e a tela
 * mostra "preço a definir" — nunca um valor inventado.
 */
export async function getPlanPrices(): Promise<PlanPrices> {
  const configured = Boolean(serverEnv.stripeSecretKey && serverEnv.stripePricePlus && serverEnv.stripePriceFamilia);
  const testMode = Boolean(serverEnv.stripeSecretKey?.startsWith("sk_test_"));
  if (!configured) return { plus: null, familia: null, configured: false, testMode };
  const [plus, familia] = await Promise.all([
    fetchPriceLabel(serverEnv.stripePricePlus as string).catch(() => null),
    fetchPriceLabel(serverEnv.stripePriceFamilia as string).catch(() => null),
  ]);
  return { plus, familia, configured: plus !== null && familia !== null, testMode };
}
