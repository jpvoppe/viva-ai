"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Archive,
  CircleCheck,
  EllipsisVertical,
  Lightbulb,
  MessageCircle,
  Pencil,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Orb } from "@/components/orb/orb";
import { useApp } from "@/components/shell/app-context";
import { useAchievements } from "@/components/shell/achievements";
import { Button, LinkButton } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, fieldAria, Input, Textarea } from "@/components/ui/field";
import { Alert, Badge, Progress } from "@/components/ui/feedback";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import {
  DeleteTaskDialog,
  QuickAddTask,
  TaskDialog,
  TaskRow,
  useTasks,
} from "@/features/organizer/task-components";
import { useServerState } from "@/hooks/use-server-state";
import type { ApiErrorBody } from "@/lib/ai/protocol";
import type { ConversationSummary, Project, Task } from "@/lib/types";
import {
  addProjectNoteAction,
  addProjectStepsAction,
  deleteProjectAction,
  deleteProjectNoteAction,
  setProjectStatusAction,
  updateProjectAction,
  type ProjectNote,
} from "./actions";

export function ProjectDetail({
  project: serverProject,
  tasks: serverTasks,
  notes: serverNotes,
  conversations,
  today,
}: {
  project: Project;
  tasks: Task[];
  notes: ProjectNote[];
  conversations: ConversationSummary[];
  today: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const achievements = useAchievements();
  const { aiConfigured, setUsage } = useApp();
  const [project, setProject] = useServerState(serverProject);
  const [notes, setNotes] = useServerState(serverNotes);
  const state = useTasks(serverTasks);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [taskDialog, setTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const ordered = state.tasks.slice().sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  const open = ordered.filter((t) => !t.completed_at);
  const done = ordered.filter((t) => t.completed_at);
  const total = ordered.length;
  const active = project.status === "ativo";

  const changeStatus = async (status: Project["status"]) => {
    const result = await setProjectStatusAction({ id: project.id, status });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setProject(result.data);
    toast.success(result.message ?? "Projeto atualizado.");
    if (status === "concluido") achievements.check();
  };

  const saveProject = async (formData: FormData) => {
    setPending(true);
    setFieldErrors({});
    const result = await updateProjectAction({ id: project.id, name: formData.get("name"), goal: formData.get("goal") ?? "" });
    setPending(false);
    if (!result.ok) {
      setFieldErrors(result.fieldErrors ?? { name: result.error });
      return;
    }
    setProject(result.data);
    setEditOpen(false);
    toast.success("Projeto atualizado.");
  };

  const suggestSteps = async () => {
    setSuggesting(true);
    setSuggestError(null);
    try {
      const response = await fetch("/api/generate/structured", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "etapas", nome: project.name, objetivo: project.goal }),
      });
      const json = (await response.json()) as
        | { items: { titulo: string }[]; usage: { used: number; limit: number } }
        | ApiErrorBody;
      if (!response.ok || !("items" in json)) {
        const body = json as ApiErrorBody;
        if (body.error?.usage) setUsage("geracao", body.error.usage.used, body.error.usage.limit);
        setSuggestError(body.error?.message ?? "Não foi possível sugerir etapas agora.");
        return;
      }
      setUsage("geracao", json.usage.used, json.usage.limit);
      const existing = new Set(state.tasks.map((t) => t.title.toLowerCase()));
      const titles = json.items.map((i) => i.titulo).filter((t) => !existing.has(t.toLowerCase()));
      setSuggestions(titles);
      setSelected(new Set(titles.map((_, index) => index)));
    } catch {
      setSuggestError("Sem conexão com o VIVA. Confira a sua internet e tente de novo.");
    } finally {
      setSuggesting(false);
    }
  };

  const acceptSuggestions = async () => {
    if (!suggestions) return;
    const titles = suggestions.filter((_, index) => selected.has(index));
    setPending(true);
    const result = await addProjectStepsAction({ project_id: project.id, titles });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    state.append(result.data);
    setSuggestions(null);
    toast.success(result.message ?? "Etapas adicionadas.");
  };

  const addNote = async () => {
    const content = noteText.trim();
    if (!content || addingNote) return;
    setAddingNote(true);
    const result = await addProjectNoteAction({ project_id: project.id, content });
    setAddingNote(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setNotes((current) => [result.data, ...current]);
    setNoteText("");
  };

  const removeNote = async (note: ProjectNote) => {
    const previous = notes;
    setNotes((current) => current.filter((n) => n.id !== note.id));
    const result = await deleteProjectNoteAction({ id: note.id });
    if (!result.ok) {
      setNotes(previous);
      toast.error(result.error);
    }
  };

  return (
    <div className="flex flex-col gap-10">
      <header>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl">{project.name}</h1>
            {project.status !== "ativo" ? (
              <Badge tone={project.status === "concluido" ? "sucesso" : "neutro"} className="mt-2">
                {project.status === "concluido" ? "Concluído" : "Arquivado"}
              </Badge>
            ) : null}
          </div>
          <Menu>
            <MenuTrigger asChild>
              <button
                type="button"
                aria-label="Opções do projeto"
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-sunken hover:text-ink"
              >
                <EllipsisVertical aria-hidden="true" className="size-5" />
              </button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem icon={<Pencil />} onSelect={() => setEditOpen(true)}>
                Editar nome e objetivo
              </MenuItem>
              {active ? (
                <>
                  <MenuItem icon={<CircleCheck />} onSelect={() => void changeStatus("concluido")}>
                    Marcar projeto como concluído
                  </MenuItem>
                  <MenuItem icon={<Archive />} onSelect={() => void changeStatus("arquivado")}>
                    Arquivar projeto
                  </MenuItem>
                </>
              ) : (
                <MenuItem icon={<RotateCcw />} onSelect={() => void changeStatus("ativo")}>
                  Reativar projeto
                </MenuItem>
              )}
              <MenuSeparator />
              <MenuItem icon={<Trash2 />} danger onSelect={() => setDeleteOpen(true)}>
                Excluir projeto
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
        {project.goal ? (
          <p className="mt-2 max-w-prose whitespace-pre-wrap text-ink-soft">{project.goal}</p>
        ) : (
          <p className="mt-2 text-ink-muted">
            Sem objetivo definido.{" "}
            <button type="button" onClick={() => setEditOpen(true)} className="font-medium text-violet-text underline underline-offset-4">
              Definir objetivo
            </button>
          </p>
        )}
        <div className="mt-5 flex items-center gap-3">
          <Progress value={done.length} max={Math.max(total, 1)} label="Progresso do projeto" className="flex-1" />
          <span className="shrink-0 text-sm tabular-nums text-ink-muted">
            {total === 0 ? "sem etapas" : `${done.length} de ${total} etapas`}
          </span>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <LinkButton href={`/app/assistente?projeto=${project.id}`}>
            <MessageCircle aria-hidden="true" className="size-4" />
            Conversar sobre o projeto
          </LinkButton>
        </div>
      </header>

      <section aria-label="Etapas">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl">Etapas</h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void suggestSteps()}
            loading={suggesting}
            loadingLabel="Pensando nas etapas"
            disabled={!aiConfigured}
            title={aiConfigured ? undefined : "A IA ainda não foi configurada neste ambiente."}
          >
            <Sparkles aria-hidden="true" className="size-4" />
            Sugerir etapas com IA
          </Button>
        </div>
        {suggesting ? (
          <p className="mb-3 flex items-center gap-2.5 text-ink-muted" role="status" aria-live="polite">
            <Orb size={22} state="pensando" />
            Pensando nas etapas…
          </p>
        ) : null}
        {suggestError ? <Alert tone="erro" title={suggestError} className="mb-3" /> : null}

        <QuickAddTask
          onSave={(input) => state.save(input)}
          defaults={{ project_id: project.id }}
          placeholder="Adicionar etapa"
          buttonLabel="Adicionar etapa"
        />

        {total === 0 ? (
          <p className="mt-4 text-ink-muted">
            Nenhuma etapa ainda. Escreva a primeira acima ou peça uma sugestão à IA.
          </p>
        ) : (
          <ul className="mt-3">
            {[...open, ...done].map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                today={today}
                onToggle={state.toggle}
                onEdit={(t) => {
                  setEditingTask(t);
                  setTaskDialog(true);
                }}
                onDelete={setDeletingTask}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Ideias">
        <h2 className="mb-3 text-xl">Ideias e anotações</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void addNote();
          }}
          className="flex flex-col gap-2"
        >
          <label htmlFor="nova-ideia" className="sr-only">
            Nova ideia ou anotação
          </label>
          <Textarea
            id="nova-ideia"
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            placeholder="Registre uma ideia, um link, um lembrete…"
            maxLength={4000}
            rows={2}
          />
          <div>
            <Button type="submit" variant="secondary" loading={addingNote} disabled={!noteText.trim()}>
              <Lightbulb aria-hidden="true" className="size-4" />
              Registrar ideia
            </Button>
          </div>
        </form>
        {notes.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {notes.map((note) => (
              <li key={note.id} className="flex items-start gap-2 rounded-md bg-sunken p-3 pr-1">
                <p className="min-w-0 flex-1 whitespace-pre-wrap">{note.content}</p>
                <button
                  type="button"
                  onClick={() => void removeNote(note)}
                  aria-label="Apagar esta ideia"
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-surface hover:text-ink"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {conversations.length > 0 ? (
        <section aria-label="Conversas do projeto">
          <h2 className="mb-1 text-xl">Conversas</h2>
          <ul>
            {conversations.map((conversation) => (
              <li key={conversation.id} className="border-b border-line last:border-b-0">
                <Link href={`/app/assistente/${conversation.id}`} className="flex min-h-12 items-center py-2 hover:text-violet-text">
                  <span className="truncate">{conversation.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Dialog
        open={editOpen}
        onOpenChange={(next) => {
          setEditOpen(next);
          if (!next) setFieldErrors({});
        }}
        title="Editar projeto"
      >
        <form action={saveProject} className="flex flex-col gap-4">
          <Field id="editar-nome" label="Nome do projeto" error={fieldErrors.name}>
            <Input {...fieldAria("editar-nome", fieldErrors.name)} name="name" defaultValue={project.name} maxLength={120} required autoFocus />
          </Field>
          <Field id="editar-objetivo" label="Objetivo" optional error={fieldErrors.goal}>
            <Textarea {...fieldAria("editar-objetivo", fieldErrors.goal)} name="goal" defaultValue={project.goal} maxLength={2000} rows={4} />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending} loadingLabel="Salvando">
              Salvar projeto
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={suggestions !== null}
        onOpenChange={(next) => {
          if (!next) setSuggestions(null);
        }}
        title="Etapas sugeridas pela IA"
        description="Escolha as que fazem sentido. Você pode editar ou apagar depois."
        footer={
          <>
            <Button variant="secondary" onClick={() => setSuggestions(null)}>
              Descartar sugestões
            </Button>
            <Button onClick={() => void acceptSuggestions()} loading={pending} disabled={selected.size === 0}>
              Adicionar {selected.size} {selected.size === 1 ? "etapa" : "etapas"}
            </Button>
          </>
        }
      >
        {suggestions && suggestions.length === 0 ? (
          <p className="text-ink-soft">A IA não trouxe etapas novas além das que você já tem.</p>
        ) : (
          <ul>
            {(suggestions ?? []).map((title, index) => (
              <li key={`${index}-${title}`} className="border-b border-line last:border-b-0">
                <Checkbox
                  id={`sugestao-${index}`}
                  label={title}
                  checked={selected.has(index)}
                  onChange={(event) =>
                    setSelected((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(index);
                      else next.delete(index);
                      return next;
                    })
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Dialog>

      <TaskDialog
        open={taskDialog}
        onOpenChange={setTaskDialog}
        task={editingTask}
        defaults={{ project_id: project.id }}
        lockProject
        onSave={state.save}
      />
      <DeleteTaskDialog task={deletingTask} onClose={() => setDeletingTask(null)} onConfirm={state.remove} />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir este projeto?"
        description="As etapas e as ideias do projeto serão apagadas. As conversas continuam no histórico. Não dá para desfazer."
        confirmLabel="Excluir projeto"
        danger
        loading={pending}
        onConfirm={async () => {
          setPending(true);
          const result = await deleteProjectAction({ id: project.id });
          setPending(false);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Projeto excluído.");
          setDeleteOpen(false);
          router.push("/app/projetos");
        }}
      />
    </div>
  );
}
