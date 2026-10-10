import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { AcceptInvite } from "@/features/family/accept-invite";
import { requireContext } from "@/lib/auth/session";
import Loading from "../../loading";

export const metadata: Metadata = { title: "Convite para o plano Família" };

export default function Page({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<Loading />}>
      <Invite params={params} />
    </Suspense>
  );
}

async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const ctx = await requireContext();
  const { token } = await params;
  return (
    <PageContainer>
      <PageHeader
        title="Convite para o VIVA Família"
        description="Você foi convidado para usar os limites do plano Família. Suas conversas, tarefas e projetos continuam privados: ninguém da família vê os seus dados."
      />
      <AcceptInvite token={token} email={ctx.email} />
    </PageContainer>
  );
}
