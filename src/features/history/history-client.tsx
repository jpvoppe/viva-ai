"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { EllipsisVertical, History, Pencil, Search, Trash2, X } from "lucide-react";
import { useApp } from "@/components/shell/app-context";
import { Button, LinkButton } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, fieldAria, Input } from "@/components/ui/field";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { deleteConversationAction, renameConversationAction } from "@/features/chat/actions";
import { daysBetween } from "@/features/organizer/dates";
import { useServerState } from "@/hooks/use-server-state";
import { todayInTimeZone } from "@/lib/utils";
import { listConversationsAction, searchConversationsAction, type HistoryItem } from "./actions";

function groupLabel(iso: string, today: string, timeZone: string): string {
  const day = todayInTimeZone(timeZone, new Date(iso));
  const diff = daysBetween(day, today);
  if (diff <= 0) return "Hoje";
  if (diff === 1) return "Ontem";
  if (diff < 7) return "Últimos 7 dias";
  if (diff < 30) return "Últimos 30 dias";
  return "Mais antigas";
}

/** Destaca o trecho encontrado (o banco marca com « »). */
function Snippet({ text }: { text: string }) {
  const parts = text.split(/(«[^»]*»)/g);
  return (
    <span className="mt-0.5 line-clamp-2 block text-sm text-ink-muted">
      {parts.map((part, index) =>
        part.startsWith("«") ? (
          <mark key={index} className="rounded-sm bg-tint-strong px-0.5 text-ink">
            {part.slice(1, -1)}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </span>
  );
}

export function HistoryClient({
  initial,
  initialHasMore,
  today,
}: {
  initial: HistoryItem[];
  initialHasMore: boolean;
  today: string;
}) {
  const toast = useToast();
  const { ctx, touchRecent, removeRecent } = useApp();
  const timeZone = ctx.profile.timezone;
  const [items, setItems] = useServerState(initial);
  const [hasMore, setHasMore] = useServerState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HistoryItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<HistoryItem | null>(null);
  const [deleting, setDeleting] = useState<HistoryItem | null>(null);
  const [pending, setPending] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const requestId = useRef(0);

  // Busca com pequena espera, para não consultar a cada tecla.
  useEffect(() => {
    const term = query.trim();
    const current = ++requestId.current;
    if (term.length < 2) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      const result = await searchConversationsAction({ query: term });
      if (current !== requestId.current) return;
      setSearching(false);
      if (!result.ok) {
        setSearchError(result.error);
        setResults([]);
        return;
      }
      setResults(result.data);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const searchingActive = query.trim().length >= 2;
  const visible = useMemo(() => (searchingActive ? (results ?? []) : items), [searchingActive, results, items]);

  const groups = useMemo(() => {
    const map = new Map<string, HistoryItem[]>();
    for (const item of visible) {
      const label = searchingActive ? "Resultados" : groupLabel(item.last_message_at, today, timeZone);
      map.set(label, [...(map.get(label) ?? []), item]);
    }
    return [...map.entries()];
  }, [visible, searchingActive, today, timeZone]);

  const loadMore = async () => {
    const last = items.at(-1);
    if (!last) return;
    setLoadingMore(true);
    const result = await listConversationsAction({ before: last.last_message_at });
    setLoadingMore(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setItems((current) => [...current, ...result.data.items]);
    setHasMore(result.data.hasMore);
  };

  const applyRename = (id: string, title: string) => {
    const update = (list: HistoryItem[]) => list.map((i) => (i.id === id ? { ...i, title } : i));
    setItems(update);
    setResults((current) => (current ? update(current) : current));
  };

  const applyDelete = (id: string) => {
    setItems((list) => list.filter((i) => i.id !== id));
    setResults((current) => (current ? current.filter((i) => i.id !== id) : current));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <label htmlFor="busca-historico" className="sr-only">
          Buscar nas conversas
        </label>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-muted" />
        <Input
          id="busca-historico"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (event.target.value.trim().length < 2) {
              setResults(null);
              setSearchError(null);
            }
          }}
          placeholder="Buscar por título ou por algo dito na conversa"
          className="pl-11 pr-11 [&::-webkit-search-cancel-button]:hidden"
          autoComplete="off"
          maxLength={200}
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults(null);
              setSearchError(null);
            }}
            aria-label="Limpar busca"
            className="absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-md text-ink-muted hover:text-ink"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        ) : null}
      </div>

      <div aria-live="polite" className="sr-only">
        {searchingActive && !searching && results ? `${results.length} conversas encontradas` : ""}
      </div>

      {searchError ? <Alert tone="erro" title={searchError} /> : null}

      {searchingActive && (searching || results === null) ? (
        <div className="flex flex-col gap-3" role="status">
          <span className="sr-only">Buscando…</span>
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : visible.length === 0 ? (
        searchingActive ? (
          <EmptyState icon={<Search />} title="Nada encontrado">
            Nenhuma conversa combina com “{query.trim()}”. Tente outra palavra.
          </EmptyState>
        ) : (
          <EmptyState
            icon={<History />}
            title="Nenhuma conversa ainda"
            action={<LinkButton href="/app/assistente">Começar uma conversa</LinkButton>}
          >
            Tudo o que você conversar com o VIVA fica guardado aqui, para continuar depois.
          </EmptyState>
        )
      ) : (
        groups.map(([label, group]) => (
          <section key={label} aria-label={label}>
            <h2 className="mb-1 font-sans text-sm font-semibold tracking-normal text-ink-soft">{label}</h2>
            <ul>
              {group.map((item) => (
                <li key={item.id} className="flex items-center gap-1 border-b border-line last:border-b-0">
                  <Link href={`/app/assistente/${item.id}`} className="min-w-0 flex-1 py-3 hover:text-violet-text">
                    <span className="block truncate font-medium">{item.title}</span>
                    {item.snippet ? (
                      <Snippet text={item.snippet} />
                    ) : (
                      <span className="block text-sm text-ink-muted">
                        {new Intl.DateTimeFormat("pt-BR", { timeZone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
                          new Date(item.last_message_at),
                        )}
                      </span>
                    )}
                  </Link>
                  <Menu>
                    <MenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Opções da conversa: ${item.title}`}
                        className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-sunken hover:text-ink"
                      >
                        <EllipsisVertical aria-hidden="true" className="size-5" />
                      </button>
                    </MenuTrigger>
                    <MenuContent>
                      <MenuItem icon={<Pencil />} onSelect={() => setRenaming(item)}>
                        Renomear conversa
                      </MenuItem>
                      <MenuItem icon={<Trash2 />} danger onSelect={() => setDeleting(item)}>
                        Excluir conversa
                      </MenuItem>
                    </MenuContent>
                  </Menu>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {!searchingActive && hasMore ? (
        <div>
          <Button variant="secondary" onClick={() => void loadMore()} loading={loadingMore} loadingLabel="Carregando">
            Carregar conversas mais antigas
          </Button>
        </div>
      ) : null}

      <Dialog
        open={renaming !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenaming(null);
            setRenameError(null);
          }
        }}
        title="Renomear conversa"
        size="sm"
      >
        <form
          key={renaming?.id}
          action={async (formData) => {
            if (!renaming) return;
            setPending(true);
            setRenameError(null);
            const result = await renameConversationAction({ id: renaming.id, title: String(formData.get("title") ?? "") });
            setPending(false);
            if (!result.ok) {
              setRenameError(result.error);
              return;
            }
            applyRename(renaming.id, result.data.title);
            touchRecent({ id: renaming.id, title: result.data.title });
            setRenaming(null);
            toast.success("Conversa renomeada.");
          }}
          className="flex flex-col gap-4"
        >
          <Field id="historico-titulo" label="Nome da conversa" error={renameError}>
            <Input {...fieldAria("historico-titulo", renameError)} name="title" defaultValue={renaming?.title} maxLength={160} required autoFocus />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setRenaming(null)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Salvar nome
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Excluir esta conversa?"
        description={deleting ? `“${deleting.title}” e os arquivos enviados nela serão apagados. Não dá para desfazer.` : ""}
        confirmLabel="Excluir conversa"
        danger
        loading={pending}
        onConfirm={async () => {
          if (!deleting) return;
          setPending(true);
          const result = await deleteConversationAction({ id: deleting.id });
          setPending(false);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          applyDelete(deleting.id);
          removeRecent(deleting.id);
          setDeleting(null);
          toast.success("Conversa excluída.");
        }}
      />
    </div>
  );
}
