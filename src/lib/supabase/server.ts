import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { serverEnv } from "@/lib/env";

/**
 * Cliente Supabase com a sessão do usuário (cookies).
 * Tudo que passa por ele obedece às políticas de acesso (RLS) do banco.
 */
export async function createClient() {
  const url = serverEnv.supabaseUrl;
  const key = serverEnv.supabaseAnonKey;
  if (!url || !key) {
    throw new ConfigError("Supabase não configurado");
  }
  // Dados de sessão só existem no momento da requisição: nunca entram em
  // conteúdo pré-renderizado ou pré-carregado.
  await connection();
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Chamado de um Server Component: o proxy já renova a sessão.
        }
      },
    },
  });
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}
