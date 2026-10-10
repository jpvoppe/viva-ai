import { existsSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Os testes de integração usam um Supabase de TESTE (local ou um projeto separado).
// Nunca aponte para o banco de produção: eles criam e apagam usuários.
for (const file of [".env.test.local", ".env.local"]) {
  if (existsSync(file)) {
    process.loadEnvFile(file);
    break;
  }
}

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Só roda contra endereço local ou quando liberado de propósito. */
const isLocal = /^(http:\/\/)(127\.0\.0\.1|localhost)(:\d+)?$/.test(SUPABASE_URL);
export const hasTestDatabase =
  Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY) && (isLocal || process.env.VIVA_TESTES_EM_BANCO_REMOTO === "1");

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type TestUser = { id: string; email: string; password: string; client: SupabaseClient };

const created: string[] = [];

export async function createTestUser(
  label: string,
  metadata: Record<string, string> = { display_name: label, age_band: "adulto", terms_accepted: "true" },
): Promise<TestUser> {
  const admin = adminClient();
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.viva.local`.toLowerCase();
  const password = "Senha-de-teste-123";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: metadata });
  if (error || !data.user) throw new Error(`criar usuário de teste: ${error?.message}`);
  created.push(data.user.id);
  const client = anonClient();
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`entrar com usuário de teste: ${signIn.error.message}`);
  return { id: data.user.id, email, password, client };
}

export async function deleteTestUsers(): Promise<void> {
  const admin = adminClient();
  while (created.length) {
    const id = created.pop() as string;
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
}
