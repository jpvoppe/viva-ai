"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookOpenCheck, Layers, Plus, Sparkles } from "lucide-react";
import { Orb } from "@/components/orb/orb";
import { useApp } from "@/components/shell/app-context";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, fieldAria, Input, Select, Textarea } from "@/components/ui/field";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import type { ApiErrorBody } from "@/lib/ai/protocol";
import type { GeneratedCard, QuizQuestion } from "@/lib/tools/structured";
import { truncate } from "@/lib/utils";
import { createDeckAction, createQuizAction } from "./actions";

export type DeckSummary = { id: string; title: string; total: number; due: number };
export type QuizSummary = { id: string; title: string; questions: number; lastScore: number | null; lastTotal: number | null };

type Mode = "cartoes" | "quiz" | "manual" | null;

export function StudyHome({ decks, quizzes }: { decks: DeckSummary[]; quizzes: QuizSummary[] }) {
  const router = useRouter();
  const toast = useToast();
  const { aiConfigured, setUsage, ctx, usage } = useApp();
  const [mode, setMode] = useState<Mode>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabled = ctx.flags.estudo !== false;
  const remaining = usage.geracao.limit - usage.geracao.used;

  const close = () => {
    if (pending) return;
    setMode(null);
    setError(null);
  };

  const generate = async (formData: FormData) => {
    if (!mode || mode === "manual") return;
    const subject = String(formData.get("assunto") ?? "").trim();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/generate/structured", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: mode,
          assunto: subject,
          nivel: formData.get("nivel"),
          quantidade: formData.get("quantidade"),
        }),
      });
      const json = (await response.json()) as
        | { items: unknown[]; usage: { used: number; limit: number } }
        | ApiErrorBody;
      if (!response.ok || !("items" in json)) {
        const body = json as ApiErrorBody;
        if (body.error?.usage) setUsage("geracao", body.error.usage.used, body.error.usage.limit);
        setError(body.error?.message ?? "Não foi possível gerar agora. Tente de novo.");
        return;
      }
      setUsage("geracao", json.usage.used, json.usage.limit);
      const title = truncate(subject.split("\n")[0], 120) || (mode === "cartoes" ? "Cartões de estudo" : "Questionário");
      if (mode === "cartoes") {
        const result = await createDeckAction({ title, level: formData.get("nivel"), cards: json.items as GeneratedCard[] });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success(`Baralho criado com ${json.items.length} cartões. Confira as respostas antes de estudar.`);
        setMode(null);
        router.push(`/app/aprender/baralho/${result.data.id}`);
      } else {
        const result = await createQuizAction({ title, questions: json.items as QuizQuestion[] });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success("Questionário criado.");
        setMode(null);
        router.push(`/app/aprender/quiz/${result.data.id}`);
      }
    } catch {
      setError("Sem conexão com o VIVA. Confira a sua internet e tente de novo.");
    } finally {
      setPending(false);
    }
  };

  const createManual = async (formData: FormData) => {
    setPending(true);
    setError(null);
    const result = await createDeckAction({ title: formData.get("title"), cards: [] });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMode(null);
    router.push(`/app/aprender/baralho/${result.data.id}`);
  };

  return (
    <div className="flex flex-col gap-10">
      {!enabled ? <Alert tone="atencao" title="Os recursos de estudo com IA estão desativados no momento." /> : null}

      <section aria-label="Cartões de estudo">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl">Cartões de estudo</h2>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setMode("cartoes")} disabled={!aiConfigured || !enabled}>
              <Sparkles aria-hidden="true" className="size-4" />
              Criar cartões com IA
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setMode("manual")}>
              <Plus aria-hidden="true" className="size-4" />
              Criar baralho vazio
            </Button>
          </div>
        </div>
        {decks.length === 0 ? (
          <EmptyState icon={<Layers />} title="Nenhum baralho ainda">
            Cartões têm uma pergunta na frente e a resposta atrás. O VIVA mostra de novo, com mais frequência, os que
            você errar.
          </EmptyState>
        ) : (
          <ul>
            {decks.map((deck) => (
              <li key={deck.id} className="border-b border-line last:border-b-0">
                <Link href={`/app/aprender/baralho/${deck.id}`} className="flex min-h-14 items-center justify-between gap-3 py-3 hover:text-violet-text">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{deck.title}</span>
                    <span className="block text-sm text-ink-muted">
                      {deck.total} {deck.total === 1 ? "cartão" : "cartões"}
                    </span>
                  </span>
                  {deck.due > 0 ? <Badge tone="marca">{deck.due} para revisar</Badge> : deck.total > 0 ? <Badge>Em dia</Badge> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Questionários">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl">Questionários</h2>
          <Button size="sm" onClick={() => setMode("quiz")} disabled={!aiConfigured || !enabled}>
            <Sparkles aria-hidden="true" className="size-4" />
            Criar questionário com IA
          </Button>
        </div>
        {quizzes.length === 0 ? (
          <EmptyState icon={<BookOpenCheck />} title="Nenhum questionário ainda">
            Perguntas de múltipla escolha sobre o assunto que você indicar, com explicação da resposta certa.
          </EmptyState>
        ) : (
          <ul>
            {quizzes.map((quiz) => (
              <li key={quiz.id} className="border-b border-line last:border-b-0">
                <Link href={`/app/aprender/quiz/${quiz.id}`} className="flex min-h-14 items-center justify-between gap-3 py-3 hover:text-violet-text">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{quiz.title}</span>
                    <span className="block text-sm text-ink-muted">{quiz.questions} perguntas</span>
                  </span>
                  {quiz.lastScore !== null ? (
                    <Badge>
                      Última vez: {quiz.lastScore} de {quiz.lastTotal}
                    </Badge>
                  ) : (
                    <Badge tone="marca">Ainda não respondido</Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!aiConfigured ? (
        <Alert tone="atencao" title="A IA ainda não foi configurada neste ambiente.">
          Você pode criar baralhos e cartões manualmente. A criação com IA depende da chave de um provedor.
        </Alert>
      ) : null}

      <Dialog
        open={mode === "cartoes" || mode === "quiz"}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={mode === "quiz" ? "Criar questionário com IA" : "Criar cartões com IA"}
        description="Escreva o assunto ou cole o texto que você está estudando."
      >
        <form action={generate} className="flex flex-col gap-4">
          {error ? <Alert tone="erro" title={error} /> : null}
          <Field id="estudo-assunto" label="Assunto ou texto-base">
            <Textarea
              {...fieldAria("estudo-assunto")}
              name="assunto"
              placeholder="Ex.: Revolução Francesa — causas e consequências"
              rows={5}
              minLength={3}
              maxLength={3000}
              required
              autoFocus
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="estudo-nivel" label="Seu nível">
              <Select id="estudo-nivel" name="nivel" defaultValue="intermediario">
                <option value="iniciante">Iniciante</option>
                <option value="intermediario">Intermediário</option>
                <option value="avancado">Avançado</option>
              </Select>
            </Field>
            <Field id="estudo-quantidade" label={mode === "quiz" ? "Perguntas" : "Cartões"}>
              <Select id="estudo-quantidade" name="quantidade" defaultValue={mode === "quiz" ? "5" : "10"}>
                {(mode === "quiz" ? [3, 5, 8, 10] : [5, 10, 15, 20]).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {pending ? (
            <p className="flex items-center gap-2.5 text-ink-muted" role="status" aria-live="polite">
              <Orb size={22} state="criando" />
              Criando… isso leva alguns segundos.
            </p>
          ) : (
            <p className="text-sm text-ink-muted">
              Usa 1 criação ({Math.max(remaining, 0)} disponíveis hoje). A IA pode errar: revise o conteúdo.
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={close} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending} loadingLabel="Criando">
              {mode === "quiz" ? "Criar questionário" : "Criar cartões"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={mode === "manual"}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title="Novo baralho"
        size="sm"
      >
        <form action={createManual} className="flex flex-col gap-4">
          <Field id="baralho-nome" label="Nome do baralho" error={error}>
            <Input {...fieldAria("baralho-nome", error)} name="title" maxLength={160} required autoFocus />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Criar baralho
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
