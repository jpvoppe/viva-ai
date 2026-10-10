import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import { ConfigError } from "./server";

let cached: SupabaseClient | null = null;

/**
 * Cliente com a chave de serviço: ignora o RLS.
 * Só pode ser usado no servidor, depois de conferir quem é o usuário,
 * e apenas para o que o usuário não pode gravar sozinho
 * (cotas, consumo, cobrança, exclusão de conta).
 */
export function createAdminClient(): SupabaseClient {
  if (cached) return cached;
  const url = serverEnv.supabaseUrl;
  const key = serverEnv.supabaseServiceKey;
  if (!url || !key) {
    throw new ConfigError("Chave de serviço do Supabase não configurada");
  }
  cached = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
