"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Check, Pencil, Play, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useAchievements } from "@/components/shell/achievements";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, fieldAria, Textarea } from "@/components/ui/field";
import { Alert, EmptyState, Progress } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { useServerState } from "@/hooks/use-server-state";
import { deleteCardAction, deleteDeckAction, reviewCardAction, saveCardAction, type Deck, type Flashcard } from "./actions";

export function DeckView({ deck, cards: serverCards, now }: { deck: Deck; cards: Flashcard[]; now: string }) {
  const router = useRouter();
  const toast = useToast();
  const achievements = useAchievements();
  const [cards, setCards] = useServerState(serverCards);
  const [session, setSession] = useState<Flashcard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState({ right: 0, wrong: 0 });
  const [grading, setGrading] = useState(false);

  const [editing, setEditing] = useState<Flashcard | "novo" | null>(null);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [deletingCard, setDeletingCard] = useState<Flashcard | null>(null);
  const [deleteDeckOpen, setDeleteDeckOpen] = useState(false);

  const due = useMemo(() => cards.filter((c) => c.due_at <= now), [cards, now]);

  const startSession = (pool: Flashcard[]) => {
    setSession(pool.slice(0, 30));
    setIndex(0);
    setFlipped(false);
    setResults({ right: 0, wrong: 0 });
  };

  const grade = async (correct: boolean) => {
    if (!session || grading) return;
    const card = session[index];
    setGrading(true);
    const result = await reviewCardAction({ id: card.id, correct });
    setGrading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setCards((list) => list.map((c) => (c.id === card.id ? result.data : c)));
    setResults((r) => (correct ? { ...r, right: r.right + 1 } : { ...r, wrong: r.wrong + 1 }));
    setFlipped(false);
    setIndex((i) => i + 1);
    if (index + 1 >= session.length) achievements.check();
  };

  const saveCard = async (formData: FormData) => {
    setPending(true);
    setFieldErrors({});
    const result = await saveCardAction({
      id: editing && editing !== "novo" ? editing.id : undefined,
      deck_id: deck.id,
      front: formData.get("front"),
      back: formData.get("back"),
    });
    setPending(false);
    if (!result.ok) {
      setFieldErrors(result.fieldErrors ?? { front: result.error });
      return;
    }
    setCards((list) =>
      editing && editing !== "novo" ? list.map((c) => (c.id === result.data.id ? result.data : c)) : [...list, result.data],
    );
    setEditing(null);
    toast.success(result.message ?? "Cartão salvo.");
  };

  // --- Sessão de revisão ---------------------------------------------------------
  if (session) {
    const finished = index >= session.length;
    const card = session[Math.min(index, session.length - 1)];
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="truncate text-xl">Revisão: {deck.title}</h1>
          <Button variant="ghost" size="sm" onClick={() => setSession(null)}>
            <X aria-hidden="true" className="size-4" />
            Encerrar revisão
          </Button>
        </div>
        <Progress value={Math.min(index, session.length)} max={session.length} label="Cartões revisados nesta sessão" />

        {finished ? (
          <div className="flex flex-col items-start gap-4 rounded-lg border border-line bg-surface p-6 animate-pop">
            <h2 className="text-2xl">Revisão concluída</h2>
            <p className="text-ink-soft">
              Você acertou {results.right} de {session.length}.{" "}
              {results.wrong > 0
                ? `Os ${results.wrong} que você errou voltam em alguns minutos.`
                : "Esses cartões voltam em alguns dias, para fixar."}
            </p>
            <div className="flex flex-wrap gap-2">
              {results.wrong > 0 ? (
                <Button onClick={() => startSession(cards.filter((c) => c.box === 1))}>
                  <RotateCcw aria-hidden="true" className="size-4" />
                  Rever os que errei
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => setSession(null)}>
                Voltar ao baralho
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-ink-muted" aria-live="polite">
              Cartão {index + 1} de {session.length}
            </p>
            <div className="[perspective:1200px]">
              <motion.button
                type="button"
                key={card.id}
                onClick={() => setFlipped((f) => !f)}
                aria-label={flipped ? "Resposta. Toque para ver a pergunta de novo." : "Pergunta. Toque para ver a resposta."}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, rotateY: flipped ? 180 : 0 }}
                transition={{ rotateY: { duration: 0.45, ease: [0.22, 1, 0.36, 1] }, default: { duration: 0.2 } }}
                className="relative block min-h-64 w-full rounded-xl text-left [transform-style:preserve-3d]"
              >
                <span className="absolute inset-0 flex flex-col rounded-xl border border-line-strong bg-surface p-6 shadow-2 [backface-visibility:hidden]">
                  <span className="text-sm text-ink-muted">Pergunta</span>
                  <span className="mt-3 flex-1 overflow-y-auto whitespace-pre-wrap font-display text-xl font-semibold">{card.front}</span>
                  <span className="mt-3 text-sm text-violet-text">Toque para ver a resposta</span>
                </span>
                <span
                  aria-hidden={!flipped}
                  className="absolute inset-0 flex flex-col rounded-xl border border-violet/40 bg-tint p-6 shadow-2 [backface-visibility:hidden] [transform:rotateY(180deg)]"
                >
                  <span className="text-sm text-ink-muted">Resposta</span>
                  <span className="mt-3 flex-1 overflow-y-auto whitespace-pre-wrap text-lg">{card.back}</span>
                </span>
              </motion.button>
            </div>
            <div aria-live="polite" className="sr-only">
              {flipped ? `Resposta: ${card.back}` : ""}
            </div>
            {flipped ? (
              <div className="grid grid-cols-2 gap-3 animate-fade-in">
                <Button variant="secondary" size="lg" onClick={() => void grade(false)} disabled={grading}>
                  <X aria-hidden="true" className="size-5 text-danger" />
                  Errei
                </Button>
                <Button size="lg" onClick={() => void grade(true)} disabled={grading}>
                  <Check aria-hidden="true" className="size-5" />
                  Acertei
                </Button>
              </div>
            ) : (
              <Button size="lg" variant="secondary" onClick={() => setFlipped(true)}>
                Ver resposta
              </Button>
            )}
          </>
        )}
      </div>
    );
  }

  // --- Baralho ------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl">{deck.title}</h1>
          <p className="mt-1 text-ink-soft">
            {cards.length} {cards.length === 1 ? "cartão" : "cartões"}
            {cards.length > 0 ? `, ${due.length} para revisar agora` : ""}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setDeleteDeckOpen(true)} className="text-danger hover:text-danger">
          <Trash2 aria-hidden="true" className="size-4" />
          Excluir baralho
        </Button>
      </header>

      <div className="flex flex-wrap gap-2">
        {due.length > 0 ? (
          <Button size="lg" onClick={() => startSession(due)}>
            <Play aria-hidden="true" className="size-4 fill-current" />
            Revisar {due.length} {due.length === 1 ? "cartão" : "cartões"}
          </Button>
        ) : cards.length > 0 ? (
          <Button size="lg" variant="secondary" onClick={() => startSession(cards)}>
            <Play aria-hidden="true" className="size-4 fill-current" />
            Revisar todos mesmo assim
          </Button>
        ) : null}
        <Button size="lg" variant="secondary" onClick={() => setEditing("novo")}>
          <Plus aria-hidden="true" className="size-4" />
          Adicionar cartão
        </Button>
      </div>

      {cards.length > 0 && due.length === 0 ? (
        <Alert tone="sucesso" title="Revisão em dia.">
          Nenhum cartão vence agora. O VIVA avisa aqui quando chegar a hora de rever.
        </Alert>
      ) : null}

      {cards.length === 0 ? (
        <EmptyState title="Este baralho está vazio" action={<Button onClick={() => setEditing("novo")}>Adicionar o primeiro cartão</Button>}>
          Cada cartão tem uma pergunta e uma resposta.
        </EmptyState>
      ) : (
        <ul>
          {cards.map((card) => (
            <li key={card.id} className="flex items-start gap-1 border-b border-line py-3 last:border-b-0">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{card.front}</p>
                <p className="mt-0.5 whitespace-pre-wrap text-ink-soft">{card.back}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(card)}
                aria-label={`Editar cartão: ${card.front}`}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-sunken hover:text-ink"
              >
                <Pencil aria-hidden="true" className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setDeletingCard(card)}
                aria-label={`Excluir cartão: ${card.front}`}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-sunken hover:text-danger"
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setFieldErrors({});
          }
        }}
        title={editing === "novo" ? "Novo cartão" : "Editar cartão"}
      >
        <form action={saveCard} className="flex flex-col gap-4" key={editing === "novo" || editing === null ? "novo" : editing.id}>
          <Field id="cartao-frente" label="Pergunta (frente)" error={fieldErrors.front}>
            <Textarea
              {...fieldAria("cartao-frente", fieldErrors.front)}
              name="front"
              defaultValue={editing && editing !== "novo" ? editing.front : ""}
              maxLength={1000}
              rows={2}
              required
              autoFocus
            />
          </Field>
          <Field id="cartao-verso" label="Resposta (verso)" error={fieldErrors.back}>
            <Textarea
              {...fieldAria("cartao-verso", fieldErrors.back)}
              name="back"
              defaultValue={editing && editing !== "novo" ? editing.back : ""}
              maxLength={2000}
              rows={3}
              required
            />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Salvar cartão
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={deletingCard !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingCard(null);
        }}
        title="Excluir este cartão?"
        description="Não dá para desfazer."
        confirmLabel="Excluir cartão"
        danger
        loading={pending}
        onConfirm={async () => {
          if (!deletingCard) return;
          setPending(true);
          const result = await deleteCardAction({ id: deletingCard.id });
          setPending(false);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          setCards((list) => list.filter((c) => c.id !== deletingCard.id));
          setDeletingCard(null);
        }}
      />

      <ConfirmDialog
        open={deleteDeckOpen}
        onOpenChange={setDeleteDeckOpen}
        title="Excluir este baralho?"
        description={`“${deck.title}” e todos os cartões serão apagados. Não dá para desfazer.`}
        confirmLabel="Excluir baralho"
        danger
        loading={pending}
        onConfirm={async () => {
          setPending(true);
          const result = await deleteDeckAction({ id: deck.id });
          setPending(false);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Baralho excluído.");
          setDeleteDeckOpen(false);
          router.push("/app/aprender");
        }}
      />
    </div>
  );
}
