import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { StudyHome, type DeckSummary, type QuizSummary } from "@/features/study/study-home";
import { requireContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import Loading from "../loading";

export const metadata: Metadata = { title: "Aprender" };

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Study />
    </Suspense>
  );
}

async function Study() {
  await requireContext();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const [decksResult, quizzesResult] = await Promise.all([
    supabase
      .from("study_decks")
      .select("id, title, flashcards(id, due_at)")
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("quizzes")
      .select("id, title, questions, quiz_attempts(score, total, created_at)")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const decks: DeckSummary[] = (decksResult.data ?? []).map((deck) => {
    const cards = (deck.flashcards ?? []) as { due_at: string }[];
    return { id: deck.id, title: deck.title, total: cards.length, due: cards.filter((c) => c.due_at <= now).length };
  });
  const quizzes: QuizSummary[] = (quizzesResult.data ?? []).map((quiz) => {
    const attempts = ((quiz.quiz_attempts ?? []) as { score: number; total: number; created_at: string }[])
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return {
      id: quiz.id,
      title: quiz.title,
      questions: Array.isArray(quiz.questions) ? quiz.questions.length : 0,
      lastScore: attempts[0]?.score ?? null,
      lastTotal: attempts[0]?.total ?? null,
    };
  });

  return (
    <PageContainer>
      <PageHeader title="Aprender" description="Cartões de estudo com repetição espaçada e questionários para testar o que você sabe." />
      <StudyHome decks={decks} quizzes={quizzes} />
    </PageContainer>
  );
}
