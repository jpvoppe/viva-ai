"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, Check, EllipsisVertical, Flag, Pencil, Repeat, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, fieldAria, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { useAchievements } from "@/components/shell/achievements";
import { useServerState } from "@/hooks/use-server-state";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";
import { createTaskAction, deleteTaskAction, toggleTaskAction, updateTaskAction } from "./actions";
import { describeDueDate } from "./dates";
import { PRIORITY_LABEL, RECURRENCE_LABEL } from "./schema";

export type ProjectOption = { id: string; name: string };

/**
 * Estado das tarefas na tela + operações.
 * A tela responde na hora (otimista) e desfaz se o servidor recusar.
 */
export function useTasks(serverTasks: Task[]) {
  const [tasks, setTasks] = useServerState(serverTasks);
  const toast = useToast();
  const achievements = useAchievements();

  const toggle = useCallback(
    async (task: Task) => {
      const done = task.completed_at === null;
      setTasks((list) =>
        list.map((t) => (t.id === task.id ? { ...t, completed_at: done ? new Date().toISOString() : null } : t)),
      );
      const result = await toggleTaskAction({ id: task.id, done });
      if (!result.ok) {
        setTasks((list) => list.map((t) => (t.id === task.id ? task : t)));
        toast.error(result.error);
        return;
      }
      setTasks((list) => {
        const next = list.map((t) => (t.id === task.id ? result.data.task : t));
        return result.data.next ? [...next, result.data.next] : next;
      });
      if (done) {
        if (result.data.next) toast.info("Tarefa concluída. A próxima ocorrência já foi criada.");
        achievements.check();
      }
    },
    [achievements, setTasks, toast],
  );

  const save = useCallback(
    async (input: Record<string, unknown>, id?: string) => {
      const result = id ? await updateTaskAction({ ...input, id }) : await createTaskAction(input);
      if (result.ok) {
        setTasks((list) => (id ? list.map((t) => (t.id === id ? result.data : t)) : [...list, result.data]));
      }
      return result;
    },
    [setTasks],
  );

  const remove = useCallback(
    async (task: Task) => {
      const result = await deleteTaskAction({ id: task.id });
      if (!result.ok) {
        toast.error(result.error);
        return false;
      }
      setTasks((list) => list.filter((t) => t.id !== task.id));
      toast.success("Tarefa excluída.");
      return true;
    },
    [setTasks, toast],
  );

  const append = useCallback(
    (added: Task[]) => {
      setTasks((list) => [...list, ...added]);
    },
    [setTasks],
  );

  return { tasks, toggle, save, remove, append };
}

export function sortTasks(a: Task, b: Task): number {
  if (a.due_date !== b.due_date) {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date < b.due_date ? -1 : 1;
  }
  if (a.priority !== b.priority) return a.priority - b.priority;
  return a.created_at < b.created_at ? -1 : 1;
}

export function TaskRow({
  task,
  today,
  projectName,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  today: string;
  projectName?: string | null;
  onToggle: (task: Task) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}) {
  const done = task.completed_at !== null;
  const overdue = !done && task.due_date !== null && task.due_date < today;

  return (
    <li className="group flex items-start gap-1 border-b border-line last:border-b-0" data-task-id={task.id}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Reabrir tarefa: ${task.title}` : `Concluir tarefa: ${task.title}`}
        onClick={() => onToggle(task)}
        className="flex size-11 shrink-0 items-center justify-center rounded-md"
      >
        <span
          className={cn(
            "flex size-[22px] items-center justify-center rounded-full border-2 transition-colors duration-150",
            done ? "border-violet bg-violet text-white" : "border-line-strong group-hover:border-violet",
          )}
        >
          <AnimatePresence initial={false}>
            {done ? (
              <motion.span
                key="check"
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.3, opacity: 0 }}
                transition={{ type: "spring", stiffness: 600, damping: 26 }}
              >
                <Check aria-hidden="true" className="size-3.5" strokeWidth={3.5} />
              </motion.span>
            ) : null}
          </AnimatePresence>
        </span>
      </button>

      <div className="min-w-0 flex-1 py-2.5">
        <p className={cn("text-base text-ink transition-colors", done && "text-ink-muted line-through")}>{task.title}</p>
        {task.notes && !done ? <p className="mt-0.5 line-clamp-2 text-sm text-ink-muted">{task.notes}</p> : null}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted empty:hidden">
          {task.due_date ? (
            <span className={cn("inline-flex items-center gap-1", overdue && "font-medium text-danger")}>
              <CalendarDays aria-hidden="true" className="size-3.5" />
              {overdue ? "Atrasada: " : null}
              {describeDueDate(task.due_date, today)}
            </span>
          ) : null}
          {task.priority === 1 && !done ? (
            <span className="inline-flex items-center gap-1 text-warning">
              <Flag aria-hidden="true" className="size-3.5" />
              Prioridade alta
            </span>
          ) : null}
          {task.recurrence !== "nenhuma" ? (
            <span className="inline-flex items-center gap-1">
              <Repeat aria-hidden="true" className="size-3.5" />
              {RECURRENCE_LABEL[task.recurrence]}
            </span>
          ) : null}
          {projectName ? <span className="truncate">Projeto: {projectName}</span> : null}
        </div>
      </div>

      {onEdit || onDelete ? (
        <Menu>
          <MenuTrigger asChild>
            <button
              type="button"
              aria-label={`Opções da tarefa: ${task.title}`}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-sunken hover:text-ink"
            >
              <EllipsisVertical aria-hidden="true" className="size-5" />
            </button>
          </MenuTrigger>
          <MenuContent>
            {onEdit ? (
              <MenuItem icon={<Pencil />} onSelect={() => onEdit(task)}>
                Editar tarefa
              </MenuItem>
            ) : null}
            {onDelete ? (
              <MenuItem icon={<Trash2 />} danger onSelect={() => onDelete(task)}>
                Excluir tarefa
              </MenuItem>
            ) : null}
          </MenuContent>
        </Menu>
      ) : null}
    </li>
  );
}

/** Formulário de criar/editar tarefa, em janela. */
export function TaskDialog({
  open,
  onOpenChange,
  task,
  defaults,
  projects,
  lockProject,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  defaults?: Partial<Pick<Task, "due_date" | "project_id" | "title">>;
  projects?: ProjectOption[];
  lockProject?: boolean;
  onSave: (input: Record<string, unknown>, id?: string) => Promise<{ ok: boolean; error?: string; fieldErrors?: Record<string, string> }>;
}) {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const editing = Boolean(task);

  const submit = async (formData: FormData) => {
    setPending(true);
    setError(null);
    setFieldErrors({});
    const result = await onSave(
      {
        title: formData.get("title"),
        notes: formData.get("notes") ?? "",
        priority: formData.get("priority"),
        due_date: formData.get("due_date") ?? "",
        recurrence: formData.get("recurrence") ?? "nenhuma",
        project_id: lockProject ? (defaults?.project_id ?? task?.project_id ?? "") : (formData.get("project_id") ?? ""),
      },
      task?.id,
    );
    setPending(false);
    if (!result.ok) {
      setFieldErrors(result.fieldErrors ?? {});
      if (!result.fieldErrors || Object.keys(result.fieldErrors).length === 0) setError(result.error ?? "Erro ao salvar.");
      return;
    }
    toast.success(editing ? "Tarefa atualizada." : "Tarefa criada.");
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setError(null);
          setFieldErrors({});
        }
      }}
      title={editing ? "Editar tarefa" : "Nova tarefa"}
    >
      <form action={submit} className="flex flex-col gap-4" key={task?.id ?? "nova"}>
        {error ? <Alert tone="erro" title={error} /> : null}
        <Field id="tarefa-titulo" label="O que precisa ser feito?" error={fieldErrors.title}>
          <Input
            {...fieldAria("tarefa-titulo", fieldErrors.title)}
            name="title"
            defaultValue={task?.title ?? defaults?.title ?? ""}
            maxLength={300}
            required
            autoFocus
          />
        </Field>
        <Field id="tarefa-notas" label="Detalhes" optional error={fieldErrors.notes}>
          <Textarea {...fieldAria("tarefa-notas", fieldErrors.notes)} name="notes" defaultValue={task?.notes ?? ""} maxLength={4000} rows={3} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="tarefa-data" label="Data" optional error={fieldErrors.due_date}>
            <Input
              {...fieldAria("tarefa-data", fieldErrors.due_date)}
              name="due_date"
              type="date"
              defaultValue={task?.due_date ?? defaults?.due_date ?? ""}
            />
          </Field>
          <Field id="tarefa-prioridade" label="Prioridade">
            <Select id="tarefa-prioridade" name="priority" defaultValue={String(task?.priority ?? 2)}>
              {[1, 2, 3].map((value) => (
                <option key={value} value={value}>
                  {PRIORITY_LABEL[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="tarefa-repeticao" label="Repetição">
            <Select id="tarefa-repeticao" name="recurrence" defaultValue={task?.recurrence ?? "nenhuma"}>
              {Object.entries(RECURRENCE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          {projects && projects.length > 0 && !lockProject ? (
            <Field id="tarefa-projeto" label="Projeto" optional>
              <Select id="tarefa-projeto" name="project_id" defaultValue={task?.project_id ?? defaults?.project_id ?? ""}>
                <option value="">Nenhum</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
        </div>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" loading={pending} loadingLabel="Salvando">
            {editing ? "Salvar alterações" : "Criar tarefa"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Confirmação de exclusão de tarefa. */
export function DeleteTaskDialog({
  task,
  onClose,
  onConfirm,
}: {
  task: Task | null;
  onClose: () => void;
  onConfirm: (task: Task) => Promise<boolean>;
}) {
  const [pending, setPending] = useState(false);
  return (
    <ConfirmDialog
      open={task !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Excluir esta tarefa?"
      description={task ? `“${task.title}” será apagada. Não dá para desfazer.` : ""}
      confirmLabel="Excluir tarefa"
      danger
      loading={pending}
      onConfirm={async () => {
        if (!task) return;
        setPending(true);
        await onConfirm(task);
        setPending(false);
        onClose();
      }}
    />
  );
}

/** Campo rápido: digitar e Enter cria a tarefa. */
export function QuickAddTask({
  onSave,
  defaults,
  placeholder = "Adicionar tarefa",
  buttonLabel = "Criar tarefa",
}: {
  onSave: (input: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
  defaults?: Record<string, unknown>;
  placeholder?: string;
  buttonLabel?: string;
}) {
  const toast = useToast();
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    const title = value.trim();
    if (!title || pending) return;
    setPending(true);
    const result = await onSave({ title, ...defaults });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error ?? "Não foi possível criar a tarefa.");
      return;
    }
    setValue("");
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex gap-2"
    >
      <label htmlFor="tarefa-rapida" className="sr-only">
        {placeholder}
      </label>
      <Input
        id="tarefa-rapida"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        maxLength={300}
        enterKeyHint="done"
        autoComplete="off"
      />
      <Button type="submit" loading={pending} loadingLabel="Criando" disabled={!value.trim()}>
        {buttonLabel}
      </Button>
    </form>
  );
}
