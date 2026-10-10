import "server-only";

/**
 * Leitura centralizada das variáveis de ambiente do servidor.
 * Nenhum valor daqui pode ser importado por componente de navegador
 * (o pacote "server-only" quebra o build se alguém tentar).
 */

function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

function readNumber(name: string): number | undefined {
  const raw = read(name);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export const serverEnv = {
  get supabaseUrl() {
    return read("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return read("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? read("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  },
  get supabaseServiceKey() {
    return read("SUPABASE_SERVICE_ROLE_KEY") ?? read("SUPABASE_SECRET_KEY");
  },
  get siteUrl() {
    return (read("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000").replace(/\/$/, "");
  },

  // IA
  get aiProvider() {
    return read("AI_PROVIDER");
  },
  get anthropicKey() {
    return read("ANTHROPIC_API_KEY");
  },
  get openaiCompatKey() {
    return read("OPENAI_COMPAT_API_KEY");
  },
  get openaiCompatBaseUrl() {
    return read("OPENAI_COMPAT_BASE_URL");
  },
  get aiModelDefault() {
    return read("AI_MODEL_PADRAO");
  },
  get aiModelAdvanced() {
    return read("AI_MODEL_AVANCADO");
  },
  get aiPricesJson() {
    return read("AI_PRECOS_JSON");
  },
  get aiDailyBudgetUsd() {
    return readNumber("AI_ORCAMENTO_DIARIO_USD");
  },
  get aiAllowMock() {
    return read("VIVA_PERMITIR_IA_SIMULADA") === "1" && process.env.VERCEL_ENV !== "production";
  },

  // Pagamentos
  get stripeSecretKey() {
    return read("STRIPE_SECRET_KEY");
  },
  get stripeWebhookSecret() {
    return read("STRIPE_WEBHOOK_SECRET");
  },
  get stripePricePlus() {
    return read("STRIPE_PRICE_PLUS");
  },
  get stripePriceFamilia() {
    return read("STRIPE_PRICE_FAMILIA");
  },
};

export function isSupabaseConfigured(): boolean {
  return Boolean(serverEnv.supabaseUrl && serverEnv.supabaseAnonKey);
}

export function isServiceRoleConfigured(): boolean {
  return Boolean(isSupabaseConfigured() && serverEnv.supabaseServiceKey);
}

export function isStripeConfigured(): boolean {
  return Boolean(serverEnv.stripeSecretKey);
}
