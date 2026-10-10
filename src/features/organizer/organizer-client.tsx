"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  ListTodo,
  Plus,
  ShoppingCart,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, fieldAria, Input, Select } from "@/components/ui/field";
import { Alert, EmptyState, Progress } from "@/components/ui/feedback";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useAchievements } from "@/components/shell/achievements";
import { useServerState } from "@/hooks/use-server-state";
import { addDays, cn } from "@/lib/utils";
import type { Task } from "@/lib/types";
import {
  addListItemAction,
  clearDoneItemsAction,
  createGoalAction,
  createListAction,
  deleteGoalAction,
  deleteListAction,
  deleteListItemAction,
  toggleListItemAction,
  updateGoalProgressAction,
  type Goal,
  type List,
} from "./actions";
import { formatLongDate, MONTHS, weekdayOf } from "./dates";
import {
  DeleteTaskDialog,
  QuickAddTask,
  sortTasks,
  TaskDialog,
  TaskRow,
  useTasks,
  type ProjectOption,
} from "./task-components";

const TAB_VALUES = ["tarefas", "calendario", "listas", "objetivos"] as const;
type TabValue = (typeof TAB_VALUES)[number];

export function OrganizerClient({
  today,
  tasks: serverTasks,
  lists: serverLists,
  goals: serverGoals,
  projects,
}: {
  today: string;
  tasks: Task[];
  lists: List[];
  goals: Goal[];
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const requested = params.get("aba");
  const tab: TabValue = TAB_VALUES.includes(requested as TabValue) ? (requested as TabValue) : "tarefas";

  const taskState = useTasks(serverTasks);
  const projectNames = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        const next = new URLSearchParams(params);
        if (value === "tarefas") next.delete("aba");
        else next.set("aba", value);
        const query = next.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      }}
    >
      <TabsList aria-label="Seções do organizador">
        <TabsTrigger value="tarefas">
          <ListTodo aria-hidden="true" className="size-4" />
          Tarefas
        </TabsTrigger>
        <TabsTrigger value="calendario">
          <CalendarDays aria-hidden="true" className="size-4" />
          Calendário
        </TabsTrigger>
        <TabsTrigger value="listas">
          <ListChecks aria-hidden="true" className="size-4" />
          Listas
        </TabsTrigger>
        <TabsTrigger value="objetivos">
          <Target aria-hidden="true" className="size-4" />
          Objetivos
        </TabsTrigger>
      </TabsList>

      <TabsContent value="tarefas">
        <TasksPanel today={today} state={taskState} projects={projects} projectNames={projectNames} />
      </TabsContent>
      <TabsContent value="calendario">
        <CalendarPanel today={today} state={taskState} projects={projects} projectNames={projectNames} />
      </TabsContent>
      <TabsContent value="listas">
        <ListsPanel lists={serverLists} />
      </TabsContent>
      <TabsContent value="objetivos">
        <GoalsPanel goals={serverGoals} />
      </TabsContent>
    </Tabs>
  );
}

type TaskState = ReturnType<typeof useTasks>;

// ---------------------------------------------------------------------------
// Tarefas
// ---------------------------------------------------------------------------
function TasksPanel({
  today,
  state,
  projects,
  projectNames,
}: {
  today: string;
  state: TaskState;
  projects: ProjectOption[];
  projectNames: Map<string, string>;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [showDone, setShowDone] = useState(false);

  const groups = useMemo(() => {
    const open = state.tasks.filter((t) => !t.completed_at).sort(sortTasks);
    const weekEnd = addDays(today, 7);
    return {
      overdue: open.filter((t) => t.due_date && t.due_date < today),
      today: open.filter((t) => t.due_date === today),
      week: open.filter((t) => t.due_date && t.due_date > today && t.due_date <= weekEnd),
      later: open.filter((t) => t.due_date && t.due_date > weekEnd),
      undated: open.filter((t) => !t.due_date),
      done: state.tasks
        .filter((t) => t.completed_at)
        .sort((a, b) => ((a.completed_at as string) < (b.completed_at as string) ? 1 : -1)),
    };
  }, [state.tasks, today]);

  const openCount = state.tasks.filter((t) => !t.completed_at).length;

  const section = (title: string, items: Task[], tone?: "danger") =>
    items.length > 0 ? (
      <section aria-label={title}>
        <h2 className={cn("mb-1 flex items-baseline gap-2 font-sans text-sm font-semibold tracking-normal", tone === "danger" ? "text-danger" : "text-ink-soft")}>
          {title}
          <span className="font-normal text-ink-muted">{items.length}</span>
        </h2>
        <ul>
          {items.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              today={today}
              projectName={task.project_id ? projectNames.get(task.project_id) : null}
              onToggle={state.toggle}
              onEdit={(t) => {
                setEditing(t);
                setDialogOpen(true);
              }}
              onDelete={setDeleting}
            />
          ))}
        </ul>
      </section>
    ) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <QuickAddTask onSave={(input) => state.save(input)} placeholder="Adicionar tarefa — escreva e aperte Enter" />
        <div>
          <Button
            variant="link"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            Criar tarefa com data, prioridade e repetição
          </Button>
        </div>
      </div>

      {openCount === 0 && groups.done.length === 0 ? (
        <EmptyState icon={<ListTodo />} title="Nenhuma tarefa por aqui">
          Escreva acima a primeira coisa que você precisa fazer. Dá para colocar data, prioridade e repetição.
        </EmptyState>
      ) : openCount === 0 ? (
        <Alert tone="sucesso" title="Tudo em dia.">
          Você não tem tarefas em aberto.
        </Alert>
      ) : null}

      {section("Atrasadas", groups.overdue, "danger")}
      {section("Hoje", groups.today)}
      {section("Próximos 7 dias", groups.week)}
      {section("Mais adiante", groups.later)}
      {section("Sem data", groups.undated)}

      {groups.done.length > 0 ? (
        <section aria-label="Concluídas">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            aria-expanded={showDone}
            className="flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-soft"
          >
            <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", showDone && "rotate-180")} />
            Concluídas
            <span className="font-normal text-ink-muted">{groups.done.length}</span>
          </button>
          {showDone ? (
            <ul className="animate-fade-in">
              {groups.done.slice(0, 50).map((task) => (
                <TaskRow key={task.id} task={task} today={today} onToggle={state.toggle} onDelete={setDeleting} />
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editing}
        projects={projects}
        onSave={state.save}
      />
      <DeleteTaskDialog task={deleting} onClose={() => setDeleting(null)} onConfirm={state.remove} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calendário
// ---------------------------------------------------------------------------
function CalendarPanel({
  today,
  state,
  projects,
  projectNames,
}: {
  today: string;
  state: TaskState;
  projects: ProjectOption[];
  projectNames: Map<string, string>;
}) {
  const [cursor, setCursor] = useState(() => today.slice(0, 7)); // AAAA-MM
  const [selected, setSelected] = useState(today);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);

  const [year, month] = cursor.split("-").map(Number);
  const firstDay = `${cursor}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = weekdayOf(firstDay);

  const byDay = useMemo(() => {
    const map = new Map<string, { open: number; done: number }>();
    for (const task of state.tasks) {
      if (!task.due_date) continue;
      const entry = map.get(task.due_date) ?? { open: 0, done: 0 };
      if (task.completed_at) entry.done++;
      else entry.open++;
      map.set(task.due_date, entry);
    }
    return map;
  }, [state.tasks]);

  const shift = (delta: number) => {
    const date = new Date(Date.UTC(year, month - 1 + delta, 1));
    setCursor(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  };

  const dayTasks = state.tasks.filter((t) => t.due_date === selected).sort(sortTasks);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-xl capitalize" aria-live="polite">
            {MONTHS[month - 1]} de {year}
          </h2>
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setCursor(today.slice(0, 7));
                setSelected(today);
              }}
            >
              Hoje
            </Button>
            <button
              type="button"
              onClick={() => shift(-1)}
              aria-label="Mês anterior"
              className="inline-flex size-11 items-center justify-center rounded-md text-ink-soft hover:bg-sunken"
            >
              <ChevronLeft aria-hidden="true" className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => shift(1)}
              aria-label="Próximo mês"
              className="inline-flex size-11 items-center justify-center rounded-md text-ink-soft hover:bg-sunken"
            >
              <ChevronRight aria-hidden="true" className="size-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 text-center text-sm text-ink-muted" aria-hidden="true">
          {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((d) => (
            <div key={d} className="py-1.5">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1" role="group" aria-label={`Dias de ${MONTHS[month - 1]}`}>
          {Array.from({ length: offset }, (_, i) => (
            <div key={`vazio-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const iso = `${cursor}-${String(day).padStart(2, "0")}`;
            const info = byDay.get(iso);
            const isToday = iso === today;
            const isSelected = iso === selected;
            const summary = info
              ? `${info.open} em aberto${info.done ? `, ${info.done} concluída${info.done > 1 ? "s" : ""}` : ""}`
              : "sem tarefas";
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelected(iso)}
                aria-pressed={isSelected}
                aria-label={`${formatLongDate(iso)}: ${summary}`}
                className={cn(
                  "relative flex aspect-square min-h-11 flex-col items-center justify-center rounded-md text-base tabular-nums transition-colors",
                  isSelected ? "bg-violet font-semibold text-white" : "hover:bg-sunken",
                  isToday && !isSelected && "font-semibold text-violet-text ring-1 ring-inset ring-violet/50",
                )}
              >
                {day}
                {info ? (
                  <span aria-hidden="true" className="absolute bottom-1.5 flex gap-0.5">
                    {info.open > 0 ? (
                      <span className={cn("size-1.5 rounded-full", isSelected ? "bg-white" : "bg-violet")} />
                    ) : null}
                    {info.done > 0 ? (
                      <span className={cn("size-1.5 rounded-full", isSelected ? "bg-white/60" : "bg-line-strong")} />
                    ) : null}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <p className="mt-2 flex flex-wrap gap-x-4 text-sm text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-violet" /> Tarefa em aberto
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-line-strong" /> Tarefa concluída
          </span>
        </p>
      </div>

      <section aria-label={`Tarefas de ${formatLongDate(selected)}`}>
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="text-lg first-letter:uppercase">{formatLongDate(selected)}</h2>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus aria-hidden="true" className="size-4" />
            Criar tarefa neste dia
          </Button>
        </div>
        {dayTasks.length === 0 ? (
          <p className="py-4 text-ink-muted">Nenhuma tarefa marcada para este dia.</p>
        ) : (
          <ul>
            {dayTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                today={today}
                projectName={task.project_id ? projectNames.get(task.project_id) : null}
                onToggle={state.toggle}
                onEdit={(t) => {
                  setEditing(t);
                  setDialogOpen(true);
                }}
                onDelete={setDeleting}
              />
            ))}
          </ul>
        )}
      </section>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editing}
        defaults={{ due_date: selected }}
        projects={projects}
        onSave={state.save}
      />
      <DeleteTaskDialog task={deleting} onClose={() => setDeleting(null)} onConfirm={state.remove} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Listas
// ---------------------------------------------------------------------------
function ListsPanel({ lists: serverLists }: { lists: List[] }) {
  const toast = useToast();
  const [lists, setLists] = useServerState(serverLists);
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<List | null>(null);

  const create = async (formData: FormData) => {
    setPending(true);
    setFormError(null);
    const result = await createListAction({ name: formData.get("name"), kind: formData.get("kind") });
    setPending(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setLists((current) => [result.data, ...current]);
    setCreateOpen(false);
    toast.success("Lista criada.");
  };

  const updateList = (id: string, updater: (list: List) => List) =>
    setLists((current) => current.map((l) => (l.id === id ? updater(l) : l)));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus aria-hidden="true" className="size-4" />
          Criar lista
        </Button>
      </div>

      {lists.length === 0 ? (
        <EmptyState icon={<ListChecks />} title="Nenhuma lista ainda">
          Listas servem para compras, malas de viagem, ideias — qualquer coisa que você queira ir marcando.
        </EmptyState>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {lists.map((list) => (
            <ListCard key={list.id} list={list} onChange={updateList} onDelete={() => setDeleting(list)} />
          ))}
        </div>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setFormError(null);
        }}
        title="Nova lista"
        size="sm"
      >
        <form action={create} className="flex flex-col gap-4">
          <Field id="lista-nome" label="Nome da lista" error={formError}>
            <Input {...fieldAria("lista-nome", formError)} name="name" maxLength={120} required autoFocus />
          </Field>
          <Field id="lista-tipo" label="Tipo">
            <Select id="lista-tipo" name="kind" defaultValue="lista">
              <option value="lista">Lista simples</option>
              <option value="compras">Lista de compras</option>
            </Select>
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Criar lista
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Excluir esta lista?"
        description={deleting ? `“${deleting.name}” e todos os itens serão apagados. Não dá para desfazer.` : ""}
        confirmLabel="Excluir lista"
        danger
        loading={pending}
        onConfirm={async () => {
          if (!deleting) return;
          setPending(true);
          const result = await deleteListAction({ id: deleting.id });
          setPending(false);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          setLists((current) => current.filter((l) => l.id !== deleting.id));
          setDeleting(null);
          toast.success("Lista excluída.");
        }}
      />
    </div>
  );
}

function ListCard({
  list,
  onChange,
  onDelete,
}: {
  list: List;
  onChange: (id: string, updater: (list: List) => List) => void;
  onDelete: () => void;
}) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);
  const doneCount = list.items.filter((i) => i.done).length;
  const Icon = list.kind === "compras" ? ShoppingCart : ListChecks;
  const inputId = `novo-item-${list.id}`;

  const add = async () => {
    const value = text.trim();
    if (!value || adding) return;
    setAdding(true);
    const result = await addListItemAction({ list_id: list.id, text: value });
    setAdding(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onChange(list.id, (l) => ({ ...l, items: [...l.items, result.data] }));
    setText("");
  };

  const toggle = async (itemId: string, done: boolean) => {
    onChange(list.id, (l) => ({ ...l, items: l.items.map((i) => (i.id === itemId ? { ...i, done } : i)) }));
    const result = await toggleListItemAction({ id: itemId, done });
    if (!result.ok) {
      onChange(list.id, (l) => ({ ...l, items: l.items.map((i) => (i.id === itemId ? { ...i, done: !done } : i)) }));
      toast.error(result.error);
    }
  };

  const remove = async (itemId: string) => {
    const previous = list.items;
    onChange(list.id, (l) => ({ ...l, items: l.items.filter((i) => i.id !== itemId) }));
    const result = await deleteListItemAction({ id: itemId });
    if (!result.ok) {
      onChange(list.id, (l) => ({ ...l, items: previous }));
      toast.error(result.error);
    }
  };

  const clearDone = async () => {
    const previous = list.items;
    onChange(list.id, (l) => ({ ...l, items: l.items.filter((i) => !i.done) }));
    const result = await clearDoneItemsAction({ list_id: list.id });
    if (!result.ok) {
      onChange(list.id, (l) => ({ ...l, items: previous }));
      toast.error(result.error);
    }
  };

  return (
    <section className="rounded-lg border border-line bg-surface p-4" aria-label={`Lista ${list.name}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-lg">
            <Icon aria-hidden="true" className="size-[18px] shrink-0 text-ink-muted" />
            <span className="truncate">{list.name}</span>
          </h3>
          <p className="text-sm text-ink-muted">
            {list.items.length === 0 ? "Sem itens" : `${doneCount} de ${list.items.length} marcados`}
          </p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Excluir lista ${list.name}`}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-sunken hover:text-danger"
        >
          <Trash2 aria-hidden="true" className="size-[18px]" />
        </button>
      </div>

      <ul>
        {list.items.map((item) => (
          <li key={item.id} className="flex items-center gap-1 border-b border-line last:border-b-0">
            <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 py-1.5">
              <input
                type="checkbox"
                checked={item.done}
                onChange={(event) => void toggle(item.id, event.target.checked)}
                className="size-5 shrink-0 rounded-[6px] accent-violet"
              />
              <span className={cn("min-w-0 break-words", item.done && "text-ink-muted line-through")}>{item.text}</span>
            </label>
            <button
              type="button"
              onClick={() => void remove(item.id)}
              aria-label={`Remover item: ${item.text}`}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-sunken hover:text-ink"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </li>
        ))}
      </ul>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
        className="mt-3 flex gap-2"
      >
        <label htmlFor={inputId} className="sr-only">
          Novo item em {list.name}
        </label>
        <Input
          id={inputId}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Novo item"
          maxLength={300}
          enterKeyHint="done"
          autoComplete="off"
        />
        <Button type="submit" variant="secondary" loading={adding} disabled={!text.trim()}>
          Adicionar item
        </Button>
      </form>
      {doneCount > 0 ? (
        <div className="mt-2">
          <Button variant="link" onClick={() => void clearDone()}>
            Remover itens marcados
          </Button>
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Objetivos
// ---------------------------------------------------------------------------
function GoalsPanel({ goals: serverGoals }: { goals: Goal[] }) {
  const toast = useToast();
  const achievements = useAchievements();
  const [goals, setGoals] = useServerState(serverGoals);
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<Goal | null>(null);

  const create = async (formData: FormData) => {
    setPending(true);
    setFieldErrors({});
    const result = await createGoalAction({
      title: formData.get("title"),
      unit: formData.get("unit") ?? "",
      target_value: formData.get("target_value"),
      due_date: formData.get("due_date") ?? "",
    });
    setPending(false);
    if (!result.ok) {
      setFieldErrors(result.fieldErrors ?? { title: result.error });
      return;
    }
    setGoals((current) => [result.data, ...current]);
    setCreateOpen(false);
    toast.success("Objetivo criado.");
  };

  const updateProgress = async (goal: Goal, value: number) => {
    const result = await updateGoalProgressAction({ id: goal.id, current_value: value });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setGoals((current) => current.map((g) => (g.id === goal.id ? result.data : g)));
    toast.success(result.message ?? "Progresso atualizado.");
    if (result.data.completed_at && !goal.completed_at) achievements.check();
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus aria-hidden="true" className="size-4" />
          Criar objetivo
        </Button>
      </div>

      {goals.length === 0 ? (
        <EmptyState icon={<Target />} title="Nenhum objetivo definido">
          Um objetivo tem uma meta em número: ler 12 livros, guardar 3.000 reais, correr 100 km. Você atualiza o
          progresso quando quiser.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-4">
          {goals.map((goal) => (
            <GoalRow key={goal.id} goal={goal} onUpdate={updateProgress} onDelete={() => setDeleting(goal)} />
          ))}
        </ul>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setFieldErrors({});
        }}
        title="Novo objetivo"
      >
        <form action={create} className="flex flex-col gap-4">
          <Field id="objetivo-titulo" label="Qual é o objetivo?" error={fieldErrors.title}>
            <Input
              {...fieldAria("objetivo-titulo", fieldErrors.title)}
              name="title"
              placeholder="Ex.: Ler mais livros este ano"
              maxLength={200}
              required
              autoFocus
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="objetivo-meta" label="Meta (número)" error={fieldErrors.target_value}>
              <Input
                {...fieldAria("objetivo-meta", fieldErrors.target_value)}
                name="target_value"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="any"
                placeholder="12"
                required
              />
            </Field>
            <Field id="objetivo-unidade" label="Unidade" optional error={fieldErrors.unit}>
              <Input {...fieldAria("objetivo-unidade", fieldErrors.unit)} name="unit" placeholder="livros" maxLength={30} />
            </Field>
          </div>
          <Field id="objetivo-prazo" label="Prazo" optional error={fieldErrors.due_date}>
            <Input {...fieldAria("objetivo-prazo", fieldErrors.due_date)} name="due_date" type="date" />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Criar objetivo
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Excluir este objetivo?"
        description={deleting ? `“${deleting.title}” será apagado. Não dá para desfazer.` : ""}
        confirmLabel="Excluir objetivo"
        danger
        loading={pending}
        onConfirm={async () => {
          if (!deleting) return;
          setPending(true);
          const result = await deleteGoalAction({ id: deleting.id });
          setPending(false);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          setGoals((current) => current.filter((g) => g.id !== deleting.id));
          setDeleting(null);
          toast.success("Objetivo excluído.");
        }}
      />
    </div>
  );
}

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function GoalRow({
  goal,
  onUpdate,
  onDelete,
}: {
  goal: Goal;
  onUpdate: (goal: Goal, value: number) => Promise<void>;
  onDelete: () => void;
}) {
  const [value, setValue] = useState(String(goal.current_value));
  const [saving, setSaving] = useState(false);
  const inputId = `progresso-${goal.id}`;
  const done = goal.completed_at !== null;
  const changed = Number(value) !== goal.current_value && value.trim() !== "" && Number.isFinite(Number(value));

  return (
    <li className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg">{goal.title}</h3>
          <p className="text-sm text-ink-muted">
            {formatNumber(goal.current_value)} de {formatNumber(goal.target_value)} {goal.unit}
            {goal.due_date ? `, até ${goal.due_date.split("-").reverse().join("/")}` : ""}
            {done ? " (alcançado)" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Excluir objetivo ${goal.title}`}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-sunken hover:text-danger"
        >
          <Trash2 aria-hidden="true" className="size-[18px]" />
        </button>
      </div>
      <Progress className="mt-3" value={goal.current_value} max={goal.target_value} label={`Progresso de ${goal.title}`} />
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (!changed) return;
          setSaving(true);
          await onUpdate(goal, Number(value));
          setSaving(false);
        }}
        className="mt-3 flex items-end gap-2"
      >
        <div className="w-36">
          <label htmlFor={inputId} className="mb-1 block text-sm text-ink-soft">
            Progresso atual
          </label>
          <Input
            id={inputId}
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary" loading={saving} disabled={!changed}>
          Salvar progresso
        </Button>
      </form>
    </li>
  );
}
