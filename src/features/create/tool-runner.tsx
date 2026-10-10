"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRef, useState } from "react";
import { Check, Copy, Download, ListPlus, RefreshCw, Save, Square } from "lucide-react";
import { Orb, orbLabel, type OrbState } from "@/components/orb/orb";
import { useApp } from "@/components/shell/app-context";
import { useAchievements } from "@/components/shell/achievements";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, fieldAria, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { useCopy } from "@/components/chat/markdown";
import { useChatStream, type StreamError } from "@/hooks/use-chat-stream";
import { getTool, validateToolValues, type ToolValues } from "@/lib/tools/registry";
import { truncate } from "@/lib/utils";
import { createListFromItemsAction, saveDocumentAction } from "./actions";
import { downloadText, extractListItems, markdownToPlainText, slugify } from "./markdown-utils";

const Markdown = dynamic(() => import("@/components/chat/markdown"));

export function ToolRunner({ toolId }: { toolId: string }) {
  const tool = getTool(toolId);
  const toast = useToast();
  const achievements = useAchievements();
  const { aiConfigured, setUsage, usage, ctx } = useApp();
  const stream = useChatStream();
  const [copied, copy] = useCopy();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<StreamError | null>(null);
  const [result, setResult] = useState("");
  const [lastValues, setLastValues] = useState<ToolValues | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [listId, setListId] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  if (!tool) return null;

  const run = (values: ToolValues) => {
    setError(null);
    setResult("");
    setSavedId(null);
    setListId(null);
    setLastValues(values);
    requestAnimationFrame(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    void stream.start({
      url: "/api/generate",
      body: { tool: tool.id, values },
      onDone: (done, text) => {
        if (done.usage) setUsage("geracao", done.usage.used, done.usage.limit);
        setResult(text);
        stream.reset();
        if (done.truncated) toast.info("O texto chegou ao tamanho máximo do seu plano.");
      },
      onError: (streamError, partial) => {
        if (streamError.usage) setUsage("geracao", streamError.usage.used, streamError.usage.limit);
        setError(streamError);
        setResult(partial);
        stream.reset();
      },
      onAbort: (partial) => {
        setResult(partial);
        stream.reset();
      },
    });
  };

  const submit = (formData: FormData) => {
    const raw: Record<string, unknown> = {};
    for (const field of tool.fields) {
      raw[field.name] = field.type === "checkbox" ? formData.get(field.name) === "on" : formData.get(field.name);
    }
    const validated = validateToolValues(tool, raw);
    if (!validated.ok) {
      setFieldErrors(validated.fieldErrors);
      return;
    }
    setFieldErrors({});
    run(validated.values);
  };

  const titleSource = lastValues ? String(lastValues[tool.titleFrom] ?? "") : "";
  const title = truncate(`${tool.title}: ${titleSource || "sem título"}`, 150);

  const save = async () => {
    setSaving(true);
    const response = await saveDocumentAction({ tool: tool.id, title, content: result });
    setSaving(false);
    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    setSavedId(response.data.id);
    toast.success("Salvo nas suas criações.");
    achievements.check();
  };

  const makeList = async () => {
    const items = extractListItems(result);
    const response = await createListFromItemsAction({
      name: truncate(titleSource || tool.title, 110),
      kind: tool.id === "compras" || tool.id === "refeicoes" ? "compras" : "lista",
      items,
    });
    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    setListId(response.data.id);
    toast.success(`Lista criada com ${response.data.count} itens.`);
  };

  const phase: OrbState = stream.phase === "parado" ? "pensando" : (stream.phase as OrbState);
  const shown = stream.running ? stream.text : result;
  const remaining = usage.geracao.limit - usage.geracao.used;
  const disabled = !aiConfigured || ctx.flags.ferramentas_criacao === false;

  return (
    <div className="flex flex-col gap-8">
      <form action={submit} className="flex flex-col gap-4" noValidate>
        {tool.fields.map((field) => {
          const id = `campo-${field.name}`;
          if (field.type === "checkbox") {
            return <Checkbox key={field.name} id={id} name={field.name} label={field.label} />;
          }
          if (field.type === "select") {
            return (
              <Field key={field.name} id={id} label={field.label} hint={field.hint}>
                <Select id={id} name={field.name} defaultValue={field.options[0].value}>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
            );
          }
          const common = {
            ...fieldAria(id, fieldErrors[field.name], Boolean(field.hint)),
            name: field.name,
            placeholder: field.placeholder,
            maxLength: field.maxLength,
            required: field.required,
          };
          return (
            <Field
              key={field.name}
              id={id}
              label={field.label}
              hint={field.hint}
              optional={!field.required}
              error={fieldErrors[field.name]}
            >
              {field.type === "textarea" ? <Textarea {...common} rows={4} /> : <Input {...common} />}
            </Field>
          );
        })}

        {!aiConfigured ? (
          <Alert tone="atencao" title="A IA ainda não foi configurada neste ambiente.">
            O administrador precisa informar a chave de um provedor de IA para esta ferramenta funcionar.
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {stream.running ? (
            <Button variant="secondary" size="lg" onClick={stream.stop}>
              <Square aria-hidden="true" className="size-4 fill-current" />
              Parar
            </Button>
          ) : (
            <Button type="submit" size="lg" disabled={disabled}>
              {tool.action}
            </Button>
          )}
          <p className="text-sm text-ink-muted">
            {remaining > 0
              ? `${remaining} de ${usage.geracao.limit} criações disponíveis hoje.`
              : "Você usou todas as criações de hoje."}
          </p>
        </div>
      </form>

      <div ref={outputRef} className="scroll-mt-20">
        {error ? (
          <Alert
            tone={error.code === "limite_plano" ? "atencao" : "erro"}
            title={error.message}
            className="mb-4"
            action={
              <>
                {error.retryable && lastValues ? (
                  <Button size="sm" variant="secondary" onClick={() => run(lastValues)}>
                    Tentar de novo
                  </Button>
                ) : null}
                {error.code === "limite_plano" && ctx.plan === "gratuito" ? (
                  <Link href="/app/configuracoes?aba=assinatura" className="inline-flex min-h-9 items-center font-medium text-violet-text underline underline-offset-4">
                    Conhecer o VIVA Plus
                  </Link>
                ) : null}
              </>
            }
          />
        ) : null}

        {stream.running || shown ? (
          <section aria-label="Resultado" className="rounded-lg border border-line bg-surface p-4 sm:p-6">
            {stream.running ? (
              <p className="mb-3 flex items-center gap-2.5 text-ink-muted" role="status" aria-live="polite">
                <Orb size={22} state={phase} />
                {orbLabel(phase)}…
              </p>
            ) : null}
            {shown ? <Markdown content={shown} /> : null}

            {!stream.running && result ? (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
                <Button variant="secondary" size="sm" onClick={() => void copy(result).then((okCopy) => okCopy && toast.success("Texto copiado."))}>
                  {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
                  Copiar texto
                </Button>
                {savedId ? (
                  <Link
                    href={`/app/criar/documento/${savedId}`}
                    className="inline-flex min-h-9 items-center gap-2 rounded-md border border-line-strong px-3 text-sm font-medium hover:bg-sunken"
                  >
                    <Check aria-hidden="true" className="size-4 text-success" />
                    Salvo — abrir para editar
                  </Link>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => void save()} loading={saving} loadingLabel="Salvando">
                    <Save aria-hidden="true" className="size-4" />
                    Salvar nas criações
                  </Button>
                )}
                <Menu>
                  <MenuTrigger asChild>
                    <Button variant="secondary" size="sm">
                      <Download aria-hidden="true" className="size-4" />
                      Baixar arquivo
                    </Button>
                  </MenuTrigger>
                  <MenuContent align="start">
                    <MenuItem onSelect={() => downloadText(`${slugify(title)}.txt`, markdownToPlainText(result), "text/plain")}>
                      Texto simples (.txt)
                    </MenuItem>
                    <MenuItem onSelect={() => downloadText(`${slugify(title)}.md`, result, "text/markdown")}>
                      Markdown (.md)
                    </MenuItem>
                  </MenuContent>
                </Menu>
                {tool.listable && extractListItems(result).length > 0 ? (
                  listId ? (
                    <Link
                      href="/app/organizador?aba=listas"
                      className="inline-flex min-h-9 items-center gap-2 rounded-md border border-line-strong px-3 text-sm font-medium hover:bg-sunken"
                    >
                      <Check aria-hidden="true" className="size-4 text-success" />
                      Lista criada — abrir no Organizador
                    </Link>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => void makeList()}>
                      <ListPlus aria-hidden="true" className="size-4" />
                      Criar lista no Organizador
                    </Button>
                  )
                ) : null}
                {lastValues ? (
                  <Button variant="ghost" size="sm" onClick={() => run(lastValues)} disabled={disabled}>
                    <RefreshCw aria-hidden="true" className="size-4" />
                    Gerar de novo
                  </Button>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
