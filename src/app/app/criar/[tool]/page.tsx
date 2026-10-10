import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { ToolRunner } from "@/features/create/tool-runner";
import { requireContext } from "@/lib/auth/session";
import { getTool, TOOLS } from "@/lib/tools/registry";
import Loading from "../../loading";

export function generateStaticParams() {
  return TOOLS.map((tool) => ({ tool: tool.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ tool: string }> }): Promise<Metadata> {
  const tool = getTool((await params).tool);
  return { title: tool?.title ?? "Criar" };
}

export default function Page({ params }: { params: Promise<{ tool: string }> }) {
  return (
    <Suspense fallback={<Loading />}>
      <Tool params={params} />
    </Suspense>
  );
}

async function Tool({ params }: { params: Promise<{ tool: string }> }) {
  const { tool: toolId } = await params;
  const tool = getTool(toolId);
  if (!tool) notFound();
  await requireContext();
  return (
    <PageContainer>
      <Link href="/app/criar" className="mb-4 inline-flex min-h-9 items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" />
        Todas as ferramentas
      </Link>
      <PageHeader title={tool.title} description={tool.description} />
      <ToolRunner key={tool.id} toolId={tool.id} />
    </PageContainer>
  );
}
