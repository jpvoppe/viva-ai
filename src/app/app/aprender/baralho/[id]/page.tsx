import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { z } from "zod";
import { PageContainer } from "@/components/shell/page";
import { DeckView } from "@/features/study/deck-view";
import type { Deck, Flashcard } from "@/features/study/actions";
import { requireContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import Loading from "../../../loading";

export const metadata: Metadata = { title: "Baralho" };

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Loading />}>
      <DeckPage params={params} />
    </Suspense>
  );
}

async function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  await requireContext();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const supabase = await createClient();
  const { data: deck } = await supabase.from("study_decks").select("id, title, level, created_at").eq("id", id.data).maybeSingle();
  if (!deck) notFound();
  const { data: cards } = await supabase
    .from("flashcards")
    .select("id, deck_id, front, back, box, due_at, review_count")
    .eq("deck_id", deck.id)
    .order("created_at", { ascending: true })
    .limit(300);
  return (
    <PageContainer>
      <Link href="/app/aprender" className="mb-4 inline-flex min-h-9 items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" />
        Voltar para Aprender
      </Link>
      <DeckView key={deck.id} deck={deck as Deck} cards={(cards ?? []) as Flashcard[]} now={new Date().toISOString()} />
    </PageContainer>
  );
}
