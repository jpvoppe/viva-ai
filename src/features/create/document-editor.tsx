"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Download, Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, fieldAria, Input, Textarea } from "@/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { deleteDocumentAction, updateDocumentAction, type DocumentRow } from "./actions";
import { downloadText, markdownToPlainText, slugify } from "./markdown-utils";

const Markdown = dynamic(() => import("@/components/chat/markdown"));

export function DocumentEditor({ document: initial }: { document: DocumentRow }) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState(initial.title);
  const [content, setContent] = useState(initial.content);
  const [saved, setSaved] = useState({ title: initial.title, content: initial.content });
  const [mode, setMode] = useState<"ver" | "editar">("ver");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const dirty = title !== saved.title || content !== saved.content;

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const save = async () => {
    setSaving(true);
    setErrors({});
    const result = await updateDocumentAction({ id: initial.id, title, content });
    setSaving(false);
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      toast.error(result.error);
      return;
    }
    setSaved({ title: result.data.title, content: result.data.content });
    setTitle(result.data.title);
    setContent(result.data.content);
    toast.success("Alterações salvas.");
  };

  return (
    <div className="flex flex-col gap-5">
      <Field id="doc-titulo" label="Título" error={errors.title}>
        <Input {...fieldAria("doc-titulo", errors.title)} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => setMode(mode === "ver" ? "editar" : "ver")}>
          {mode === "ver" ? <Pencil aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
          {mode === "ver" ? "Editar texto" : "Ver resultado"}
        </Button>
        <Menu>
          <MenuTrigger asChild>
            <Button variant="secondary" size="sm">
              <Download aria-hidden="true" className="size-4" />
              Baixar arquivo
            </Button>
          </MenuTrigger>
          <MenuContent align="start">
            <MenuItem onSelect={() => downloadText(`${slugify(title)}.txt`, markdownToPlainText(content), "text/plain")}>
              Texto simples (.txt)
            </MenuItem>
            <MenuItem onSelect={() => downloadText(`${slugify(title)}.md`, content, "text/markdown")}>
              Markdown (.md)
            </MenuItem>
          </MenuContent>
        </Menu>
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          Imprimir
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)} className="text-danger hover:text-danger">
          <Trash2 aria-hidden="true" className="size-4" />
          Excluir criação
        </Button>
      </div>

      {mode === "editar" ? (
        <Field id="doc-conteudo" label="Texto (aceita Markdown)" error={errors.content}>
          <Textarea
            {...fieldAria("doc-conteudo", errors.content)}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={18}
            maxLength={120000}
            className="font-mono text-sm"
          />
        </Field>
      ) : (
        <article className="rounded-lg border border-line bg-surface p-4 sm:p-6">
          <Markdown content={content} />
        </article>
      )}

      <div className="sticky bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom,0px)+0.75rem)] flex items-center gap-3 lg:bottom-4">
        <Button onClick={() => void save()} loading={saving} loadingLabel="Salvando" disabled={!dirty} className="shadow-2">
          Salvar alterações
        </Button>
        {dirty ? <span className="rounded-full bg-raised px-3 py-1 text-sm text-ink-muted shadow-1">Há alterações não salvas</span> : null}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir esta criação?"
        description="O texto será apagado. Não dá para desfazer."
        confirmLabel="Excluir criação"
        danger
        loading={saving}
        onConfirm={async () => {
          setSaving(true);
          const result = await deleteDocumentAction({ id: initial.id });
          setSaving(false);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Criação excluída.");
          setDeleteOpen(false);
          router.push("/app/criar");
        }}
      />
    </div>
  );
}
