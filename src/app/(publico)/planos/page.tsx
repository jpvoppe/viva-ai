import type { Metadata } from "next";
import { Suspense } from "react";
import { PlanTable } from "@/components/plans/plan-table";
import { LinkButton } from "@/components/ui/button";
import { getPlanPrices } from "@/lib/billing/prices";
import { FAMILY_MAX_PEOPLE } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Planos e limites",
  description: "Compare os planos Gratuito, VIVA Plus e VIVA Família: mensagens por dia, arquivos, criações e o que cada um inclui.",
  alternates: { canonical: "/planos" },
};

const actions = {
  gratuito: (
    <LinkButton href="/criar-conta" variant="secondary" className="w-full">
      Começar no Gratuito
    </LinkButton>
  ),
  plus: (
    <LinkButton href="/criar-conta" className="w-full">
      Criar conta para assinar
    </LinkButton>
  ),
  familia: (
    <LinkButton href="/criar-conta" variant="secondary" className="w-full">
      Criar conta para assinar
    </LinkButton>
  ),
};

export default function PlansPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:py-20">
      <h1 className="text-4xl sm:text-5xl" style={{ fontStretch: "86%" }}>
        Planos e limites
      </h1>
      <p className="mb-10 mt-4 max-w-prose text-lg text-ink-soft">
        Todo mundo começa no Gratuito. Os limites abaixo são os mesmos que o sistema aplica: o que está escrito aqui é
        o que você recebe.
      </p>
      <Suspense fallback={<PlanTable prices={{ plus: null, familia: null }} actions={actions} />}>
        <Plans />
      </Suspense>

      <div className="mt-12 grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="text-xl">Como os limites funcionam</h2>
          <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-ink-soft">
            <li>Os limites são por dia e voltam ao normal à meia-noite, no seu fuso horário.</li>
            <li>Se a IA falhar e não responder, a mensagem não é descontada.</li>
            <li>Tarefas, listas, objetivos, projetos, histórico e conversor de unidades não consomem limite.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-xl">Assinatura sem surpresa</h2>
          <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-ink-soft">
            <li>O pagamento é processado pelo Stripe. O VIVA não guarda os dados do seu cartão.</li>
            <li>Você cancela sozinho, nas Configurações, e mantém o acesso até o fim do período pago.</li>
            <li>No VIVA Família, até {FAMILY_MAX_PEOPLE} pessoas usam os limites do Plus, cada uma com a própria conta e dados privados.</li>
            <li>Assinaturas só podem ser contratadas por maiores de 18 anos.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

async function Plans() {
  const prices = await getPlanPrices();
  return <PlanTable prices={prices} actions={actions} />;
}
