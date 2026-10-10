import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeftRight, FileText, GraduationCap } from "lucide-react";
import { PageContainer, PageHeader, SectionTitle } from "@/components/shell/page";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { ToolIcon } from "@/features/create/tool-icons";
import { requireContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { TOOL_GROUPS, TOOLS, getTool } from "@/lib/tools/registry";
import Loading from "../loading";

export const metadata: Metadata = { title: "Criar" };

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <CreateHub />
    </Suspense>
  );
}

function ToolLink({ href, icon, title, description }: { href: string; icon: React.ReactNode; title: string; description: string }) {
  return (
    <li className="border-b border-line">
      <Link href={href} className="group flex min-h-16 items-center gap-3.5 py-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-tint text-violet-text transition-colors group-hover:bg-tint-strong [&>svg]:size-5">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block font-medium text-ink group-hover:text-violet-text">{title}</span>
          <span className="block text-sm text-ink-muted">{description}</span>
        </span>
      </Link>
    </li>
  );
}

async function CreateHub() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data: documents } = await supabase
    .from("documents")
    .select("id, tool, title, updated_at")
    .order("updated_at", { ascending: false })
    .limit(30);
  const toolsEnabled = ctx.flags.ferramentas_criacao !== false;

  return (
    <PageContainer>
      <PageHeader
        title="Criar"
        description="Escolha uma ferramenta, preencha o que souber e receba um rascunho para revisar."
      />

      {!toolsEnabled ? (
        <Alert tone="atencao" title="As ferramentas de criação estão desativadas no momento." className="mb-8" />
      ) : null}

      <div className="flex flex-col gap-10">
        {TOOL_GROUPS.map((group) => (
          <section key={group.id} aria-label={group.title}>
            <SectionTitle>{group.title}</SectionTitle>
            <ul className="grid gap-x-8 sm:grid-cols-2">
              {TOOLS.filter((tool) => tool.group === group.id).map((tool) => (
                <ToolLink
                  key={tool.id}
                  href={`/app/criar/${tool.id}`}
                  icon={<ToolIcon name={tool.icon} />}
                  title={tool.title}
                  description={tool.description}
                />
              ))}
              {group.id === "estudo" ? (
                <ToolLink
                  href="/app/aprender"
                  icon={<GraduationCap aria-hidden="true" />}
                  title="Cartões e questionários"
                  description="Revise com cartões de estudo e teste o que aprendeu."
                />
              ) : null}
              {group.id === "dia_a_dia" ? (
                <ToolLink
                  href="/app/criar/conversor"
                  icon={<ArrowLeftRight aria-hidden="true" />}
                  title="Conversor de unidades"
                  description="Medidas, pesos, temperatura e mais. Cálculo exato, sem IA."
                />
              ) : null}
            </ul>
          </section>
        ))}

        <section aria-label="Suas criações">
          <SectionTitle>Suas criações</SectionTitle>
          {documents && documents.length > 0 ? (
            <ul>
              {documents.map((doc) => (
                <li key={doc.id} className="border-b border-line last:border-b-0">
                  <Link href={`/app/criar/documento/${doc.id}`} className="flex min-h-14 items-center gap-3 py-2.5 hover:text-violet-text">
                    <FileText aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{doc.title}</span>
                      <span className="block text-sm text-ink-muted">
                        {getTool(doc.tool)?.title ?? "Criação"}, salvo em{" "}
                        {new Intl.DateTimeFormat("pt-BR", { timeZone: ctx.profile.timezone, day: "numeric", month: "long" }).format(
                          new Date(doc.updated_at),
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<FileText />} title="Nada salvo ainda">
              Quando você gerar um texto e tocar em “Salvar nas criações”, ele aparece aqui para editar e baixar.
            </EmptyState>
          )}
        </section>
      </div>
    </PageContainer>
  );
}
