import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { CircleAlert, CircleCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { isServiceRoleConfigured, isStripeConfigured, isSupabaseConfigured } from "@/lib/env";
import { getAiSetup } from "@/lib/ai";

export const metadata: Metadata = { title: "Configuração pendente", robots: { index: false } };

/** Mostra, sem expor nenhum valor, quais integrações ainda faltam configurar. */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <Status />
    </Suspense>
  );
}

async function Status() {
  // Lê a configuração no momento do acesso, não no build.
  await connection();
  const ai = getAiSetup();
  const items = [
    {
      ok: isSupabaseConfigured(),
      name: "Banco de dados e login (Supabase)",
      missing: "Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    },
    {
      ok: isServiceRoleConfigured(),
      name: "Chave de serviço do Supabase (limites, cobrança e exclusão de conta)",
      missing: "Defina SUPABASE_SERVICE_ROLE_KEY apenas no servidor.",
    },
    {
      ok: ai.configured,
      name: "Provedor de IA",
      missing: ai.configured ? "" : ai.reason,
    },
    {
      ok: isStripeConfigured(),
      name: "Pagamentos (Stripe) — opcional para começar",
      missing: "Defina STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET e os preços dos planos.",
    },
  ];
  const ready = items[0].ok && items[1].ok;

  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-5 py-12">
      <Logo />
      <h1 className="mt-8 text-3xl">{ready ? "Configuração do VIVA" : "Falta conectar o VIVA aos serviços"}</h1>
      <p className="mt-2 text-ink-soft">
        Esta página mostra só o que está ou não configurado. Os valores das chaves ficam no arquivo{" "}
        <code className="rounded bg-sunken px-1">.env.local</code> ou no painel da hospedagem — veja o README.
      </p>
      <ul className="mt-8 flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.name} className="flex items-start gap-3 rounded-md border border-line bg-surface p-4">
            {item.ok ? (
              <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
            ) : (
              <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
            )}
            <div>
              <p className="font-medium">
                {item.name}: {item.ok ? "configurado" : "pendente"}
              </p>
              {!item.ok ? <p className="mt-0.5 text-ink-soft">{item.missing}</p> : null}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-8">
        <Link href={ready ? "/entrar" : "/"} className="font-medium text-violet-text underline underline-offset-4">
          {ready ? "Ir para a tela de entrada" : "Voltar para a página inicial"}
        </Link>
      </p>
    </main>
  );
}
