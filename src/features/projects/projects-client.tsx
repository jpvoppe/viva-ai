"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FolderKanban, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, fieldAria, Input, Textarea } from "@/components/ui/field";
import { Alert, Badge, EmptyState, Progress } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { useAchievements } from "@/components/shell/achievements";
import { createProjectAction } from "./actions";

export type ProjectSummary = {
  id: string;
  name: string;
  goal: string;
  status: "ativo" | "concluido" | "arquivado";
  total: number;
  done: number;
};

export function ProjectsClient({ projects }: { projects: ProjectSummary[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const achievements = useAchievements();
  const wantsNew = params.get("novo") === "1";
  const [open, setOpen] = useState(wantsNew);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Atalho "Transforme uma ideia em um projeto" chega com ?novo=1.
  useEffect(() => {
    if (!wantsNew) return;
    router.replace(pathname, { scroll: false });
  }, [wantsNew, pathname, router]);

  const create = async (formData: FormData) => {
    setPending(true);
    setError(null);
    setFieldErrors({});
    const result = await createProjectAction({ name: formData.get("name"), goal: formData.get("goal") ?? "" });
    if (!result.ok) {
      setPending(false);
      if (result.fieldErrors && Object.keys(result.fieldErrors).length) setFieldErrors(result.fieldErrors);
      else setError(result.error);
      return;
    }
    toast.success("Projeto criado.");
    achievements.check();
    // Esta tela fica guardada em memória: fecha a janela antes de sair.
    setPending(false);
    setOpen(false);
    router.push(`/app/projetos/${result.data.id}`);
  };

  const active = projects.filter((p) => p.status === "ativo");
  const others = projects.filter((p) => p.status !== "ativo");

  const row = (project: ProjectSummary) => (
    <li key={project.id} className="border-b border-line last:border-b-0">
      <Link href={`/app/projetos/${project.id}`} className="group block py-4">
        <span className="flex items-start justify-between gap-4">
          <span className="min-w-0">
            <span className="block font-display text-lg font-semibold group-hover:text-violet-text">{project.name}</span>
            {project.goal ? <span className="mt-0.5 line-clamp-2 block text-ink-soft">{project.goal}</span> : null}
          </span>
          {project.status !== "ativo" ? (
            <Badge tone={project.status === "concluido" ? "sucesso" : "neutro"}>
              {project.status === "concluido" ? "Concluído" : "Arquivado"}
            </Badge>
          ) : null}
        </span>
        <span className="mt-3 flex items-center gap-3">
          <Progress value={project.done} max={Math.max(project.total, 1)} label={`Progresso de ${project.name}`} className="flex-1" />
          <span className="shrink-0 text-sm tabular-nums text-ink-muted">
            {project.total === 0 ? "sem etapas" : `${project.done} de ${project.total}`}
          </span>
        </span>
      </Link>
    </li>
  );

  return (
    <>
      <div className="mb-6">
        <Button onClick={() => setOpen(true)}>
          <Plus aria-hidden="true" className="size-4" />
          Criar projeto
        </Button>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban />}
          title="Nenhum projeto ainda"
          action={<Button onClick={() => setOpen(true)}>Criar o primeiro projeto</Button>}
        >
          Um projeto junta objetivo, etapas, ideias e conversas com o VIVA em um só lugar. Serve para uma reforma, um
          curso, uma viagem, um negócio.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-10">
          {active.length > 0 ? (
            <section aria-label="Projetos ativos">
              <h2 className="text-lg">Em andamento</h2>
              <ul>{active.map(row)}</ul>
            </section>
          ) : (
            <Alert tone="info" title="Nenhum projeto em andamento.">
              Crie um novo ou reative um projeto abaixo.
            </Alert>
          )}
          {others.length > 0 ? (
            <section aria-label="Projetos concluídos e arquivados">
              <h2 className="text-lg">Concluídos e arquivados</h2>
              <ul>{others.map(row)}</ul>
            </section>
          ) : null}
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setError(null);
            setFieldErrors({});
          }
        }}
        title="Novo projeto"
        description="Comece só com o nome. Objetivo e etapas você completa depois."
      >
        <form action={create} className="flex flex-col gap-4">
          {error ? <Alert tone="erro" title={error} /> : null}
          <Field id="projeto-nome" label="Nome do projeto" error={fieldErrors.name}>
            <Input
              {...fieldAria("projeto-nome", fieldErrors.name)}
              name="name"
              placeholder="Ex.: Reforma da cozinha"
              maxLength={120}
              required
              autoFocus
            />
          </Field>
          <Field id="projeto-objetivo" label="Qual é o objetivo?" optional error={fieldErrors.goal} hint="O VIVA usa o objetivo para sugerir etapas e conversar sobre o projeto.">
            <Textarea {...fieldAria("projeto-objetivo", fieldErrors.goal, true)} name="goal" maxLength={2000} rows={3} />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending} loadingLabel="Criando">
              Criar projeto
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
