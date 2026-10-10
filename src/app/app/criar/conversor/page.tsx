import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { UnitConverter } from "@/features/create/unit-converter";

export const metadata: Metadata = { title: "Conversor de unidades" };

export default function Page() {
  return (
    <PageContainer>
      <Link href="/app/criar" className="mb-4 inline-flex min-h-9 items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" />
        Todas as ferramentas
      </Link>
      <PageHeader title="Conversor de unidades" description="Comprimento, peso, volume, temperatura, área, tempo e velocidade." />
      <UnitConverter />
    </PageContainer>
  );
}
