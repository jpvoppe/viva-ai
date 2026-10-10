"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CircleCheck, CircleX, RotateCcw, Trash2 } from "lucide-react";
import { useAchievements } from "@/components/shell/achievements";
import { useApp } from "@/components/shell/app-context";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Alert, Progress } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { useServerState } from "@/hooks/use-server-state";
import type { QuizQuestion } from "@/lib/tools/structured";
import { cn } from "@/lib/utils";
import { deleteQuizAction, saveQuizAttemptAction } from "./actions";

export type QuizAttempt = { id: string; score: number; total: number; created_at: string };

export function QuizView({
  quiz,
  attempts: initialAttempts,
}: {
  quiz: { id: string; title: string; questions: QuizQuestion[] };
  attempts: QuizAttempt[];
}) {
  const router = useRouter();
  const toast = useToast();
  const achievements = useAchievements();
  const timeZone = useApp().ctx.profile.timezone;
  const total = quiz.questions.length;
  const [started, setStarted] = useState(initialAttempts.length === 0);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [choice, setChoice] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [final, setFinal] = useState<{ score: number; total: number } | null>(null);
  const [attempts, setAttempts] = useServerState(initialAttempts);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const question = quiz.questions[Math.min(index, total - 1)];

  const restart = () => {
    setStarted(true);
    setIndex(0);
    setAnswers([]);
    setChoice(null);
    setRevealed(false);
    setFinal(null);
  };

  const next = async () => {
    if (choice === null) return;
    const all = [...answers, choice];
    setAnswers(all);
    setChoice(null);
    setRevealed(false);
    if (index + 1 < total) {
      setIndex(index + 1);
      return;
    }
    setSaving(true);
    const result = await saveQuizAttemptAction({ quiz_id: quiz.id, answers: all });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      setFinal({ score: all.filter((a, i) => a === quiz.questions[i].correta).length, total });
      return;
    }
    setFinal(result.data);
    setAttempts((list) => [{ id: `local-${Date.now()}`, ...result.data, created_at: new Date().toISOString() }, ...list]);
    achievements.check();
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl">{quiz.title}</h1>
          <p className="mt-1 text-ink-soft">{total} perguntas de múltipla escolha</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)} className="text-danger hover:text-danger">
          <Trash2 aria-hidden="true" className="size-4" />
          Excluir questionário
        </Button>
      </header>

      {!started ? (
        <div className="flex flex-col items-start gap-4">
          <Button size="lg" onClick={restart}>
            <RotateCcw aria-hidden="true" className="size-4" />
            Responder de novo
          </Button>
        </div>
      ) : final ? (
        <div className="flex flex-col items-start gap-4 rounded-lg border border-line bg-surface p-6 animate-pop">
          <h2 className="text-2xl">
            Você acertou {final.score} de {final.total}
          </h2>
          <Progress value={final.score} max={final.total} label="Acertos" />
          <p className="text-ink-soft">
            {final.score === final.total
              ? "Tudo certo. Se quiser fixar, refaça daqui a alguns dias."
              : "Reveja as explicações das que você errou e tente de novo quando quiser."}
          </p>
          <Button onClick={restart}>
            <RotateCcw aria-hidden="true" className="size-4" />
            Responder de novo
          </Button>
        </div>
      ) : (
        <section aria-label={`Pergunta ${index + 1} de ${total}`} className="flex flex-col gap-4">
          <Progress value={index} max={total} label="Perguntas respondidas" />
          <p className="text-sm text-ink-muted">
            Pergunta {index + 1} de {total}
          </p>
          <fieldset className="flex flex-col gap-2" disabled={revealed}>
            <legend className="mb-3 font-display text-xl font-semibold">{question.pergunta}</legend>
            {question.opcoes.map((option, optionIndex) => {
              const isChoice = choice === optionIndex;
              const isCorrect = optionIndex === question.correta;
              return (
                <label
                  key={optionIndex}
                  className={cn(
                    "flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-4 py-2.5 transition-colors",
                    !revealed && isChoice && "border-violet bg-tint",
                    !revealed && !isChoice && "border-line-strong hover:border-ink-muted",
                    revealed && isCorrect && "border-success bg-success-bg",
                    revealed && isChoice && !isCorrect && "border-danger bg-danger-bg",
                    revealed && !isChoice && !isCorrect && "border-line opacity-70",
                    revealed && "cursor-default",
                  )}
                >
                  <input
                    type="radio"
                    name={`pergunta-${index}`}
                    checked={isChoice}
                    onChange={() => setChoice(optionIndex)}
                    className="size-5 shrink-0 accent-violet"
                  />
                  <span className="min-w-0 flex-1">{option}</span>
                  {revealed && isCorrect ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-success">
                      <CircleCheck aria-hidden="true" className="size-4" /> Correta
                    </span>
                  ) : null}
                  {revealed && isChoice && !isCorrect ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-danger">
                      <CircleX aria-hidden="true" className="size-4" /> Sua resposta
                    </span>
                  ) : null}
                </label>
              );
            })}
          </fieldset>

          {revealed ? (
            <Alert
              tone={choice === question.correta ? "sucesso" : "info"}
              title={choice === question.correta ? "Você acertou." : "Não foi desta vez."}
            >
              {question.explicacao || `A resposta correta é: ${question.opcoes[question.correta]}.`}
            </Alert>
          ) : null}

          <div>
            {revealed ? (
              <Button size="lg" onClick={() => void next()} loading={saving} loadingLabel="Salvando o resultado">
                {index + 1 < total ? "Próxima pergunta" : "Ver resultado"}
              </Button>
            ) : (
              <Button size="lg" onClick={() => setRevealed(true)} disabled={choice === null}>
                Conferir resposta
              </Button>
            )}
          </div>
        </section>
      )}

      {attempts.length > 0 ? (
        <section aria-label="Tentativas anteriores">
          <h2 className="mb-1 text-lg">Tentativas</h2>
          <ul>
            {attempts.slice(0, 10).map((attempt) => (
              <li key={attempt.id} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
                <span className="text-ink-soft">
                  {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(attempt.created_at))}
                </span>
                <span className="font-medium tabular-nums">
                  {attempt.score} de {attempt.total}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir este questionário?"
        description="As perguntas e as tentativas serão apagadas. Não dá para desfazer."
        confirmLabel="Excluir questionário"
        danger
        loading={saving}
        onConfirm={async () => {
          setSaving(true);
          const result = await deleteQuizAction({ id: quiz.id });
          setSaving(false);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Questionário excluído.");
          setDeleteOpen(false);
          router.push("/app/aprender");
        }}
      />
    </div>
  );
}
