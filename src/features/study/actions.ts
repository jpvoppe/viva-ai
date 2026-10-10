"use server";

import { z } from "zod";
import { fail, ok, runAction } from "@/lib/actions";
import { cardSchema, quizQuestionSchema, type QuizQuestion } from "@/lib/tools/structured";
import type { ActionResult } from "@/lib/types";
import { nextReview } from "./leitner";

export type Flashcard = {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  box: number;
  due_at: string;
  review_count: number;
};
export type Deck = { id: string; title: string; level: string; created_at: string };

const CARD_COLUMNS = "id, deck_id, front, back, box, due_at, review_count";
const titleSchema = z.string().trim().min(1, "Dê um nome para o baralho.").max(160, "Use até 160 caracteres.");
const frontSchema = z.string().trim().min(1, "Escreva a pergunta.").max(1000, "Use até 1.000 caracteres.");
const backSchema = z.string().trim().min(1, "Escreva a resposta.").max(2000, "Use até 2.000 caracteres.");

export async function createDeckAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(
    "estudo.baralho.criar",
    z.object({
      title: titleSchema,
      level: z.enum(["iniciante", "intermediario", "avancado"]).default("intermediario"),
      cards: z.array(cardSchema).max(40).default([]),
    }),
    input,
    async ({ title, level, cards }, { supabase }) => {
      const { data: deck, error } = await supabase.from("study_decks").insert({ title, level }).select("id").single();
      if (error || !deck) throw new Error(error?.message ?? "baralho não criado");
      if (cards.length > 0) {
        const { error: cardsError } = await supabase
          .from("flashcards")
          .insert(cards.map((c) => ({ deck_id: deck.id, front: c.frente, back: c.verso })));
        if (cardsError) {
          await supabase.from("study_decks").delete().eq("id", deck.id);
          throw new Error(cardsError.message);
        }
      }
      return ok({ id: deck.id as string }, "Baralho criado.");
    },
  );
}

export async function renameDeckAction(input: unknown): Promise<ActionResult> {
  return runAction("estudo.baralho.renomear", z.object({ id: z.uuid(), title: titleSchema }), input, async ({ id, title }, { supabase }) => {
    const { error } = await supabase.from("study_decks").update({ title }).eq("id", id);
    if (error) throw new Error(error.message);
    return ok(undefined, "Baralho renomeado.");
  });
}

export async function deleteDeckAction(input: { id: string }): Promise<ActionResult> {
  return runAction("estudo.baralho.excluir", z.object({ id: z.uuid() }), input, async ({ id }, { supabase }) => {
    const { error } = await supabase.from("study_decks").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return ok(undefined, "Baralho excluído.");
  });
}

export async function saveCardAction(input: unknown): Promise<ActionResult<Flashcard>> {
  return runAction(
    "estudo.cartao.salvar",
    z.object({ id: z.uuid().optional(), deck_id: z.uuid(), front: frontSchema, back: backSchema }),
    input,
    async ({ id, deck_id, front, back }, { supabase }) => {
      if (id) {
        const { data, error } = await supabase
          .from("flashcards")
          .update({ front, back })
          .eq("id", id)
          .select(CARD_COLUMNS)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) return fail("Este cartão não existe mais.");
        return ok(data as Flashcard, "Cartão atualizado.");
      }
      const { count } = await supabase.from("flashcards").select("id", { count: "exact", head: true }).eq("deck_id", deck_id);
      if ((count ?? 0) >= 300) return fail("Este baralho chegou ao limite de 300 cartões.");
      const { data, error } = await supabase.from("flashcards").insert({ deck_id, front, back }).select(CARD_COLUMNS).single();
      if (error || !data) {
        if (error?.code === "42501") return fail("Este baralho não existe mais.");
        throw new Error(error?.message ?? "cartão não criado");
      }
      return ok(data as Flashcard, "Cartão criado.");
    },
  );
}

export async function deleteCardAction(input: { id: string }): Promise<ActionResult> {
  return runAction("estudo.cartao.excluir", z.object({ id: z.uuid() }), input, async ({ id }, { supabase }) => {
    const { error } = await supabase.from("flashcards").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return ok(undefined, "Cartão excluído.");
  });
}

/** Registra uma revisão: o servidor calcula a nova caixa e a próxima data. */
export async function reviewCardAction(input: unknown): Promise<ActionResult<Flashcard>> {
  return runAction(
    "estudo.cartao.revisar",
    z.object({ id: z.uuid(), correct: z.boolean() }),
    input,
    async ({ id, correct }, { supabase }) => {
      const { data: card } = await supabase.from("flashcards").select(CARD_COLUMNS).eq("id", id).maybeSingle();
      if (!card) return fail("Este cartão não existe mais.");
      const next = nextReview(card.box, correct);
      const { data, error } = await supabase
        .from("flashcards")
        .update({ box: next.box, due_at: next.dueAt.toISOString(), review_count: card.review_count + 1 })
        .eq("id", id)
        .select(CARD_COLUMNS)
        .single();
      if (error || !data) throw new Error(error?.message ?? "revisão não registrada");
      return ok(data as Flashcard);
    },
  );
}

export async function createQuizAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(
    "estudo.quiz.criar",
    z.object({
      title: z.string().trim().min(1).max(160),
      questions: z.array(quizQuestionSchema).min(1, "O questionário precisa de pelo menos uma pergunta.").max(20),
    }),
    input,
    async (data, { supabase }) => {
      const { data: quiz, error } = await supabase.from("quizzes").insert(data).select("id").single();
      if (error || !quiz) throw new Error(error?.message ?? "questionário não criado");
      return ok({ id: quiz.id as string }, "Questionário criado.");
    },
  );
}

export async function deleteQuizAction(input: { id: string }): Promise<ActionResult> {
  return runAction("estudo.quiz.excluir", z.object({ id: z.uuid() }), input, async ({ id }, { supabase }) => {
    const { error } = await supabase.from("quizzes").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return ok(undefined, "Questionário excluído.");
  });
}

/** Grava uma tentativa. A nota é calculada no servidor, com o gabarito guardado no banco. */
export async function saveQuizAttemptAction(input: unknown): Promise<ActionResult<{ score: number; total: number }>> {
  return runAction(
    "estudo.quiz.tentativa",
    z.object({ quiz_id: z.uuid(), answers: z.array(z.number().int().min(-1).max(10)).max(20) }),
    input,
    async ({ quiz_id, answers }, { supabase }) => {
      const { data: quiz } = await supabase.from("quizzes").select("questions").eq("id", quiz_id).maybeSingle();
      if (!quiz) return fail("Este questionário não existe mais.");
      const questions = quiz.questions as QuizQuestion[];
      if (answers.length !== questions.length) return fail("Responda todas as perguntas antes de finalizar.");
      const score = questions.reduce((sum, q, index) => sum + (answers[index] === q.correta ? 1 : 0), 0);
      const { error } = await supabase
        .from("quiz_attempts")
        .insert({ quiz_id, score, total: questions.length, answers });
      if (error) throw new Error(error.message);
      return ok({ score, total: questions.length });
    },
  );
}
