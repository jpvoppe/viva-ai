import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { z } from "zod";
import { PageContainer } from "@/components/shell/page";
import { QuizView, type QuizAttempt } from "@/features/study/quiz-view";
import { requireContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { quizQuestionSchema } from "@/lib/tools/structured";
import Loading from "../../../loading";

export const metadata: Metadata = { title: "Questionário" };

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Loading />}>
      <QuizPage params={params} />
    </Suspense>
  );
}

async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  await requireContext();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const supabase = await createClient();
  const { data: quiz } = await supabase.from("quizzes").select("id, title, questions").eq("id", id.data).maybeSingle();
  if (!quiz) notFound();
  const questions = z.array(quizQuestionSchema).safeParse(quiz.questions);
  if (!questions.success || questions.data.length === 0) notFound();
  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("id, score, total, created_at")
    .eq("quiz_id", quiz.id)
    .order("created_at", { ascending: false })
    .limit(10);
  return (
    <PageContainer>
      <Link href="/app/aprender" className="mb-4 inline-flex min-h-9 items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" />
        Voltar para Aprender
      </Link>
      <QuizView
        key={quiz.id}
        quiz={{ id: quiz.id, title: quiz.title, questions: questions.data }}
        attempts={(attempts ?? []) as QuizAttempt[]}
      />
    </PageContainer>
  );
}
