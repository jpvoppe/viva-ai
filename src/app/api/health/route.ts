import { connection } from "next/server";
import { isSupabaseConfigured, serverEnv } from "@/lib/env";

/** Verificação simples para monitoramento: o app está no ar e alcança o banco? Não expõe detalhes. */
export async function GET() {
  await connection();
  let database = false;
  if (isSupabaseConfigured()) {
    try {
      const response = await fetch(`${serverEnv.supabaseUrl}/auth/v1/health`, {
        headers: { apikey: serverEnv.supabaseAnonKey ?? "" },
        signal: AbortSignal.timeout(4000),
        cache: "no-store",
      });
      database = response.ok;
    } catch {
      database = false;
    }
  }
  return Response.json(
    { status: database ? "ok" : "degradado", app: true, banco: database },
    { status: database ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
