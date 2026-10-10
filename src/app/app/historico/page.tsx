import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { HistoryClient } from "@/features/history/history-client";
import type { HistoryItem } from "@/features/history/actions";
import { requireContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { todayInTimeZone } from "@/lib/utils";
import Loading from "../loading";

export const metadata: Metadata = { title: "Histórico" };

const PAGE_SIZE = 30;

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <HistoryPage />
    </Suspense>
  );
}

async function HistoryPage() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select("id, title, last_message_at")
    .order("last_message_at", { ascending: false })
    .limit(PAGE_SIZE + 1);
  const rows = data ?? [];
  return (
    <PageContainer>
      <PageHeader title="Histórico" description="Todas as suas conversas com o VIVA. Busque, renomeie ou apague." />
      <HistoryClient
        initial={rows.slice(0, PAGE_SIZE).map((r) => ({ ...r, snippet: null })) as HistoryItem[]}
        initialHasMore={rows.length > PAGE_SIZE}
        today={todayInTimeZone(ctx.profile.timezone)}
      />
    </PageContainer>
  );
}
