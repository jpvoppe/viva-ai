import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { z } from "zod";
import { PageContainer } from "@/components/shell/page";
import { DocumentEditor } from "@/features/create/document-editor";
import type { DocumentRow } from "@/features/create/actions";
import { requireContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import Loading from "../../../loading";

export const metadata: Metadata = { title: "Criação" };

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Loading />}>
      <Doc params={params} />
    </Suspense>
  );
}

async function Doc({ params }: { params: Promise<{ id: string }> }) {
  await requireContext();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("id, tool, title, content, project_id, updated_at")
    .eq("id", id.data)
    .maybeSingle();
  if (!data) notFound();
  return (
    <PageContainer>
      <Link href="/app/criar" className="no-print mb-4 inline-flex min-h-9 items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" />
        Voltar para Criar
      </Link>
      <h1 className="sr-only">{data.title}</h1>
      <DocumentEditor key={data.id} document={data as DocumentRow} />
    </PageContainer>
  );
}
