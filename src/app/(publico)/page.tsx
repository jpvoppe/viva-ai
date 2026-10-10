import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarCheck, FolderKanban, GraduationCap, Lock, PenLine } from "lucide-react";
import { PlanTable } from "@/components/plans/plan-table";
import { LinkButton } from "@/components/ui/button";
import { HeroDemo } from "@/features/landing/hero-demo";
import { getPlanPrices } from "@/lib/billing/prices";
import { PLANS } from "@/lib/plans";
import { site } from "@/lib/site";
import { AccountDeletedNotice } from "@/features/landing/account-deleted-notice";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const AREAS = [
  {
    icon: GraduationCap,
    title: "Aprender",
    text: "Explicações passo a passo no seu nível, resumos, cartões de estudo com repetição espaçada, questionários e plano de estudos.",
  },
  {
    icon: CalendarCheck,
    title: "Organizar",
    text: "Tarefas com data, prioridade e repetição, calendário, listas de compras e objetivos com progresso.",
  },
  {
    icon: PenLine,
    title: "Criar",
    text: "Rascunhos de mensagens, legendas, roteiros, convites, descrições de produto e estruturas de apresentação, no tom que você escolher.",
  },
  {
    icon: FolderKanban,
    title: "Tirar projetos do papel",
    text: "Defina o objetivo, peça sugestões de etapas, registre ideias e converse com o VIVA sabendo em que pé o projeto está.",
  },
];

const free = PLANS.gratuito.limits;

const FAQ: { q: string; a: string }[] = [
  {
    q: "O VIVA é gratuito?",
    a: `Sim, existe um plano Gratuito sem cartão de crédito, com ${free.dailyMessages} mensagens ao assistente, ${free.dailyGenerations} criações nas ferramentas e ${free.dailyFiles} arquivos por dia. Organizador, projetos e histórico não têm limite. Os planos pagos aumentam esses limites.`,
  },
  {
    q: "O VIVA acerta sempre?",
    a: "Não. Como toda inteligência artificial, ele pode errar ou estar desatualizado. O VIVA é instruído a dizer quando não sabe e a não inventar fontes, mas confira informações importantes — principalmente em saúde, dinheiro e questões legais.",
  },
  {
    q: "O VIVA pesquisa na internet em tempo real?",
    a: "Por padrão, não. Para preços, horários e notícias, ele avisa que a informação não foi verificada em tempo real e sugere onde conferir.",
  },
  {
    q: "Quem pode ver as minhas conversas?",
    a: "Só você. Cada conta enxerga apenas os próprios dados, inclusive no plano Família. As mensagens são enviadas ao provedor de IA apenas para gerar a resposta. Você pode baixar ou apagar tudo quando quiser.",
  },
  {
    q: "Que arquivos posso enviar?",
    a: "Imagens (PNG, JPG, WEBP, GIF), PDF com texto, Word (.docx) e arquivos de texto (TXT, MD, CSV). PDFs digitalizados, sem texto selecionável, ainda não são lidos.",
  },
  {
    q: "A partir de que idade dá para usar?",
    a: "A partir de 13 anos. Para quem tem de 13 a 17, o VIVA adapta as respostas à idade e a contratação de planos fica com um responsável.",
  },
  {
    q: "Como cancelo uma assinatura?",
    a: "Em Configurações, Assinatura, Gerenciar assinatura. O cancelamento é feito por você, em poucos cliques, e o acesso continua até o fim do período já pago.",
  },
];

export default function LandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "VIVA AI",
        applicationCategory: "ProductivityApplication",
        operatingSystem: "Web",
        inLanguage: "pt-BR",
        url: site.url,
        description:
          "Assistente pessoal com inteligência artificial para estudar, organizar tarefas, criar conteúdo e planejar projetos.",
        offers: { "@type": "Offer", price: "0", priceCurrency: "BRL", description: "Plano Gratuito" },
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Suspense fallback={null}>
        <AccountDeletedNotice />
      </Suspense>

      {/* Abertura */}
      <section className="relative isolate overflow-hidden bg-[#15131c] text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -left-40 -top-56 -z-10 size-[44rem] rounded-full bg-[radial-gradient(circle,rgb(109_59_245/0.5),transparent_62%)]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-72 right-[-12rem] -z-10 size-[46rem] rounded-full bg-[radial-gradient(circle,rgb(31_107_255/0.38),transparent_62%)]" />
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-20">
          <div>
            <h1
              className="max-w-[13ch] text-[2.75rem] font-semibold leading-[0.95] tracking-[-0.035em] sm:text-6xl lg:text-7xl"
              style={{ fontStretch: "80%" }}
            >
              O assistente inteligente para a vida cotidiana
            </h1>
            <p className="mt-6 max-w-[46ch] text-lg text-white/75">
              Estude, organize a semana, escreva e planeje projetos conversando em português. Você diz o que precisa
              resolver; o VIVA ajuda a chegar lá.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <LinkButton href="/criar-conta" size="lg">
                Criar conta gratuita
              </LinkButton>
              <Link href="/planos" className="inline-flex min-h-12 items-center rounded-md px-4 font-medium text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">
                Ver planos e limites
              </Link>
            </div>
            <p className="mt-4 text-sm text-white/60">Sem cartão de crédito. Leva menos de um minuto.</p>
          </div>
          <HeroDemo />
        </div>
      </section>

      {/* O que dá para fazer */}
      <section aria-labelledby="areas" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
          <div>
            <h2 id="areas" className="text-3xl sm:text-4xl" style={{ fontStretch: "88%" }}>
              Um lugar só para o que ocupa a sua cabeça
            </h2>
            <p className="mt-4 max-w-prose text-lg text-ink-soft">
              O VIVA junta a conversa com a IA e as ferramentas para pôr a resposta em prática: a explicação vira
              cartões de estudo, o plano vira tarefas, a ideia vira projeto.
            </p>
          </div>
          <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {AREAS.map((area) => (
              <li key={area.title}>
                <area.icon aria-hidden="true" className="size-6 text-violet-text" />
                <h3 className="mt-3 text-xl">{area.title}</h3>
                <p className="mt-1.5 text-ink-soft">{area.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Como começar */}
      <section aria-labelledby="como-comecar" className="border-y border-line bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <h2 id="como-comecar" className="text-3xl sm:text-4xl" style={{ fontStretch: "88%" }}>
            Como começar
          </h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3">
            {[
              ["Crie a conta", "Nome, e-mail e senha. Você escolhe o tema e o estilo das respostas, ou pula tudo."],
              ["Escreva o que precisa", "Na tela inicial há um campo só: “O que vamos resolver hoje?”. Dá para anexar um arquivo ou ditar por voz."],
              ["Transforme em ação", "Salve o texto, crie tarefas, monte um projeto. O que você fizer fica guardado para continuar depois."],
            ].map(([title, text], index) => (
              <li key={title} className="flex gap-4">
                <span aria-hidden="true" className="font-display text-4xl font-semibold leading-none text-violet-text" style={{ fontStretch: "80%" }}>
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-xl">{title}</h3>
                  <p className="mt-1.5 text-ink-soft">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Planos */}
      <section aria-labelledby="planos" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <h2 id="planos" className="text-3xl sm:text-4xl" style={{ fontStretch: "88%" }}>
          Planos com limites às claras
        </h2>
        <p className="mb-8 mt-4 max-w-prose text-lg text-ink-soft">
          Comece no Gratuito. Se precisar de mais mensagens, respostas mais longas ou quiser dividir com a família, há
          planos pagos.
        </p>
        <Suspense fallback={<PlanTable prices={{ plus: null, familia: null }} />}>
          <LandingPlans />
        </Suspense>
      </section>

      {/* Privacidade */}
      <section aria-labelledby="privacidade" className="bg-surface">
        <div className="mx-auto grid w-full max-w-6xl gap-8 border-y border-line px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:py-20">
          <div>
            <Lock aria-hidden="true" className="size-6 text-violet-text" />
            <h2 id="privacidade" className="mt-3 text-3xl sm:text-4xl" style={{ fontStretch: "88%" }}>
              Seus dados, suas regras
            </h2>
          </div>
          <ul className="flex flex-col gap-4 text-lg text-ink-soft">
            <li>Cada conta só enxerga os próprios dados. A proteção é feita no banco de dados, não só na tela.</li>
            <li>A memória personalizada vem desligada. Ligada, guarda apenas o que você mandar, e você vê, edita e apaga tudo.</li>
            <li>Você baixa uma cópia dos seus dados ou exclui a conta por conta própria, nas Configurações.</li>
            <li>
              Sem contadores falsos, sem urgência artificial e sem cancelamento escondido.{" "}
              <Link href="/privacidade" className="font-medium text-violet-text underline underline-offset-4">
                Ler a Política de privacidade
              </Link>
            </li>
          </ul>
        </div>
      </section>

      {/* Perguntas frequentes */}
      <section aria-labelledby="faq" className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:py-24">
        <h2 id="faq" className="text-3xl sm:text-4xl" style={{ fontStretch: "88%" }}>
          Perguntas frequentes
        </h2>
        <div className="mt-8 divide-y divide-line border-y border-line">
          {FAQ.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-lg font-medium [&::-webkit-details-marker]:hidden">
                {item.q}
                <span aria-hidden="true" className="text-2xl font-normal text-ink-muted transition-transform duration-200 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="max-w-prose pb-5 text-ink-soft">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Chamada final */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
        <div className="relative isolate overflow-hidden rounded-xl bg-[#15131c] px-6 py-12 text-white sm:px-12 sm:py-16">
          <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-40 -z-10 size-[30rem] rounded-full bg-[radial-gradient(circle,rgb(109_59_245/0.55),transparent_62%)]" />
          <h2 className="max-w-[16ch] text-4xl font-semibold leading-[0.98] sm:text-5xl" style={{ fontStretch: "82%" }}>
            O que vamos resolver hoje?
          </h2>
          <div className="mt-8">
            <LinkButton href="/criar-conta" size="lg">
              Criar conta gratuita
            </LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}

async function LandingPlans() {
  const prices = await getPlanPrices();
  return (
    <PlanTable
      prices={prices}
      actions={{
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
      }}
    />
  );
}
