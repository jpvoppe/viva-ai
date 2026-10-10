import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getUserContext } from "@/lib/auth/session";
import { apiError, isSameOrigin } from "@/lib/api/respond";
import { checkRateLimit, RATE_RULES } from "@/lib/limits/rate-limit";
import { consumeQuota, refundQuota } from "@/lib/limits/quota";
import { isServiceRoleConfigured } from "@/lib/env";
import { getPlan } from "@/lib/plans";
import { getAiSetup, modelForPlan } from "@/lib/ai";
import { buildTurns, titleFromMessage, type CurrentAttachment, type HistoryMessage } from "@/lib/ai/context";
import { buildSystemPrompt } from "@/lib/ai/prompts";
import { describeAiError } from "@/lib/ai/errors";
import { encodeEvent, type ServerEvent } from "@/lib/ai/protocol";
import { getBudgetStatus, recordUsage } from "@/lib/ai/usage";
import { AiError } from "@/lib/ai/types";
import { ATTACHMENTS_BUCKET } from "@/lib/files/storage";
import { logError } from "@/lib/log";

export const maxDuration = 120;

const bodySchema = z
  .object({
    conversationId: z.uuid().nullish(),
    projectId: z.uuid().nullish(),
    content: z.string().max(100_000).default(""),
    fileIds: z.array(z.uuid()).max(4).default([]),
    /** Gera de novo a resposta da última mensagem do usuário. */
    regenerate: z.boolean().default(false),
  })
  .refine((v) => v.regenerate || v.content.trim().length > 0, { message: "Mensagem vazia." })
  .refine((v) => !v.regenerate || Boolean(v.conversationId), { message: "Conversa não informada." });

type FileRow = {
  id: string;
  name: string;
  kind: "imagem" | "documento";
  mime_type: string;
  storage_path: string;
  extracted_text: string | null;
  text_truncated: boolean;
};

const IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

/**
 * Conversa com o assistente.
 * Ordem das verificações (todas no servidor): sessão → recurso habilitado →
 * limite de requisições → IA configurada → validação → orçamento → cota do plano.
 * Só então a IA é chamada, e a resposta é transmitida aos poucos.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError("requisicao_invalida", "Origem não permitida.", { status: 403 });

  const user = await getSessionUser();
  if (!user) return apiError("sessao_expirada", "Sua sessão expirou. Entre de novo para continuar.");
  const ctx = await getUserContext();
  if (!ctx) return apiError("sessao_expirada", "Sua sessão expirou. Entre de novo para continuar.");

  if (ctx.flags.assistente === false) {
    return apiError("recurso_desativado", "O assistente está temporariamente desativado.");
  }
  if (!(await checkRateLimit(`chat:${user.id}`, RATE_RULES.chat))) {
    return apiError("muitas_requisicoes", "Muitas mensagens em pouco tempo. Aguarde um minuto e tente de novo.", {
      retryable: true,
    });
  }

  const ai = getAiSetup();
  if (!ai.configured || !isServiceRoleConfigured()) {
    return apiError(
      "ia_nao_configurada",
      "A IA ainda não foi configurada neste ambiente. O administrador precisa informar a chave do provedor.",
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return apiError("requisicao_invalida", "Não foi possível entender a mensagem enviada.");
  }

  const plan = getPlan(ctx.plan);
  const content = body.content.trim();
  if (content.length > plan.limits.maxInputChars) {
    return apiError(
      "mensagem_grande",
      `A mensagem tem ${content.length.toLocaleString("pt-BR")} caracteres; o limite do plano ${plan.name} é ${plan.limits.maxInputChars.toLocaleString("pt-BR")}. Encurte o texto ou envie como arquivo.`,
    );
  }

  const budget = await getBudgetStatus();
  if (budget.limited) {
    await logError("ia.orcamento", "Orçamento diário de IA atingido", "orcamento_esgotado");
    return apiError(
      "orcamento_esgotado",
      "O VIVA atingiu o limite de uso de IA de hoje. Tente de novo mais tarde.",
      { retryable: true },
    );
  }

  const supabase = await createClient();

  // --- Conversa -------------------------------------------------------------
  let conversationId = body.conversationId ?? null;
  let projectId: string | null = null;
  let title = "";
  if (conversationId) {
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id, title, project_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conversation) return apiError("nao_encontrado", "Esta conversa não existe mais.");
    projectId = conversation.project_id;
    title = conversation.title;
  } else if (body.projectId) {
    const { data: project } = await supabase.from("projects").select("id").eq("id", body.projectId).maybeSingle();
    if (!project) return apiError("nao_encontrado", "Este projeto não existe mais.");
    projectId = project.id;
  }

  // --- Histórico (antes da mensagem atual) ---------------------------------------
  let history: HistoryMessage[] = [];
  let lastAssistantToReplace: string | null = null;
  let currentText = content;
  let userMessageId: string | null = null;
  let regenerateFiles: FileRow[] = [];

  if (conversationId) {
    const { data: rows } = await supabase
      .from("messages")
      .select("id, role, content, status")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(40);
    const ordered = (rows ?? []).reverse();

    if (body.regenerate) {
      const last = ordered.at(-1);
      if (last?.role === "assistant") {
        lastAssistantToReplace = last.id;
        ordered.pop();
      }
      const lastUser = ordered.at(-1);
      if (!lastUser || lastUser.role !== "user") {
        return apiError("requisicao_invalida", "Não há mensagem para responder de novo.");
      }
      currentText = lastUser.content;
      userMessageId = lastUser.id;
      ordered.pop();
      const { data: links } = await supabase
        .from("message_files")
        .select("files(id, name, kind, mime_type, storage_path, extracted_text, text_truncated)")
        .eq("message_id", lastUser.id);
      regenerateFiles = ((links ?? []) as unknown as { files: FileRow | null }[])
        .map((l) => l.files)
        .filter((f): f is FileRow => f !== null);
    }
    history = ordered
      .filter((m) => m.status !== "erro")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  }

  // --- Anexos da mensagem atual -----------------------------------------------
  let fileRows: FileRow[] = regenerateFiles;
  if (!body.regenerate && body.fileIds.length > 0) {
    if (ctx.flags.anexos === false) {
      return apiError("recurso_desativado", "O envio de arquivos está desativado no momento.");
    }
    const { data: files } = await supabase
      .from("files")
      .select("id, name, kind, mime_type, storage_path, extracted_text, text_truncated")
      .in("id", body.fileIds);
    fileRows = (files ?? []) as FileRow[];
    if (fileRows.length !== body.fileIds.length) {
      return apiError("nao_encontrado", "Um dos arquivos anexados não foi encontrado. Envie de novo.");
    }
  }

  const attachments: CurrentAttachment[] = [];
  for (const file of fileRows) {
    if (file.kind === "documento") {
      attachments.push({
        kind: "documento",
        name: file.name,
        text: file.extracted_text ?? "",
        truncated: file.text_truncated,
      });
      continue;
    }
    if (!ai.provider.supportsImages) {
      return apiError("arquivo_invalido", "O modelo de IA configurado não analisa imagens.");
    }
    const mediaType = IMAGE_MIMES.find((m) => m === file.mime_type);
    const download = await supabase.storage.from(ATTACHMENTS_BUCKET).download(file.storage_path);
    if (!mediaType || download.error || !download.data) {
      return apiError("armazenamento_indisponivel", `Não foi possível abrir a imagem “${file.name}”. Envie de novo.`, {
        retryable: true,
      });
    }
    attachments.push({
      kind: "imagem",
      name: file.name,
      mediaType,
      dataBase64: Buffer.from(await download.data.arrayBuffer()).toString("base64"),
    });
  }

  // --- Cota do plano (só agora, depois de tudo validado) ---------------------
  const quota = await consumeQuota(user.id, ctx.plan, "mensagem", ctx.profile.timezone);
  if (!quota.allowed) {
    return apiError(
      "limite_plano",
      ctx.plan === "gratuito"
        ? `Você usou as ${quota.limit} mensagens de hoje do plano Gratuito. O limite volta amanhã — ou conheça o VIVA Plus.`
        : `Você usou as ${quota.limit} mensagens de hoje do seu plano. O limite volta amanhã.`,
      { usage: { used: quota.used, limit: quota.limit } },
    );
  }

  // --- Grava a mensagem do usuário ---------------------------------------------
  try {
    if (!conversationId) {
      title = titleFromMessage(content);
      const { data: created, error } = await supabase
        .from("conversations")
        .insert({ title, project_id: projectId })
        .select("id")
        .single();
      if (error || !created) throw new Error(error?.message ?? "conversa não criada");
      conversationId = created.id;
    }
    if (!body.regenerate) {
      const { data: inserted, error } = await supabase
        .from("messages")
        .insert({ conversation_id: conversationId, role: "user", content })
        .select("id")
        .single();
      if (error || !inserted) throw new Error(error?.message ?? "mensagem não gravada");
      userMessageId = inserted.id;
      if (fileRows.length > 0) {
        const { error: linkError } = await supabase
          .from("message_files")
          .insert(fileRows.map((f) => ({ message_id: inserted.id, file_id: f.id })));
        if (linkError) throw new Error(linkError.message);
      }
    } else if (lastAssistantToReplace) {
      await supabase.from("messages").delete().eq("id", lastAssistantToReplace);
    }
  } catch (error) {
    await refundQuota(user.id, "mensagem", quota.period);
    await logError("chat.gravar", error);
    return apiError("erro_interno", "Não foi possível salvar a sua mensagem. Tente de novo.", { retryable: true });
  }

  // --- Contexto do modelo ------------------------------------------------------
  const [memories, project] = await Promise.all([
    ctx.preferences.memory_enabled
      ? supabase
          .from("memories")
          .select("content")
          .order("created_at", { ascending: true })
          .limit(Math.min(plan.limits.maxMemories, 40))
          .then((r) => (r.data ?? []).map((m) => m.content as string))
      : Promise.resolve([] as string[]),
    projectId ? loadProject(supabase, projectId) : Promise.resolve(null),
  ]);

  const webSearch =
    ctx.flags.pesquisa_web === true && plan.limits.webSearch && ai.provider.supportsWebSearch;
  const model = modelForPlan(ai, ctx.plan);
  const system = buildSystemPrompt({
    displayName: ctx.profile.display_name,
    ageBand: ctx.profile.age_band,
    responseStyle: ctx.preferences.response_style,
    timeZone: ctx.profile.timezone,
    now: new Date(),
    memories,
    project,
    webSearch,
  });
  const turns = buildTurns(history, { text: currentText, attachments }, plan.limits);

  // --- Transmissão -------------------------------------------------------------
  const finalConversationId = conversationId as string;
  const encoder = new TextEncoder();
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort(), { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: ServerEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        } catch {
          closed = true;
        }
      };

      let text = "";
      let inputTokens = 0;
      let outputTokens = 0;
      let truncated = false;
      let failure: unknown = null;

      send({
        type: "meta",
        conversationId: finalConversationId,
        userMessageId,
        title,
        simulated: ai.simulated,
      });

      try {
        for await (const event of ai.provider.stream(
          { model, system, messages: turns, maxOutputTokens: plan.limits.maxOutputTokens, webSearch, purpose: "chat" },
          abort.signal,
        )) {
          if (event.type === "delta") {
            text += event.text;
            send({ type: "delta", text: event.text });
          } else if (event.type === "status") {
            send({ type: "status", activity: event.activity });
          } else if (event.type === "usage") {
            inputTokens = event.inputTokens;
            outputTokens = event.outputTokens;
          } else if (event.type === "end") {
            truncated = event.stopReason === "limite_tokens";
          }
        }
      } catch (error) {
        failure = error;
      }

      const interrupted = failure instanceof AiError && failure.code === "interrompida";
      const hasText = text.trim().length > 0;

      // Sem contagem do provedor (ex.: interrompida cedo), estima pelos caracteres.
      if (!inputTokens && !outputTokens && (hasText || interrupted)) {
        outputTokens = Math.ceil(text.length / 3);
      }

      try {
        if (failure && !interrupted && !hasText) {
          // Falhou antes de produzir qualquer coisa: devolve a cota e avisa.
          await refundQuota(user.id, "mensagem", quota.period);
          await recordUsage({
            userId: user.id, feature: "chat", provider: ai.provider.id, model,
            inputTokens, outputTokens, status: "erro",
          });
          const described = describeAiError(failure);
          await logError("chat.ia", failure, failure instanceof AiError ? failure.code : undefined);
          send({ type: "error", ...described });
        } else {
          const status = failure ? "interrompida" : "completa";
          let messageId: string | null = null;
          if (hasText) {
            const { data: saved, error } = await supabase
              .from("messages")
              .insert({
                conversation_id: finalConversationId,
                role: "assistant",
                content: text,
                status,
                model,
                input_tokens: inputTokens,
                output_tokens: outputTokens,
              })
              .select("id")
              .single();
            if (error) await logError("chat.gravar_resposta", error);
            messageId = saved?.id ?? null;
          } else if (interrupted) {
            // Parou antes da primeira palavra: não houve resposta, devolve a cota.
            await refundQuota(user.id, "mensagem", quota.period);
            quota.used = Math.max(quota.used - 1, 0);
          }
          await recordUsage({
            userId: user.id, feature: "chat", provider: ai.provider.id, model,
            inputTokens, outputTokens, status: failure ? "interrompida" : "ok",
          });
          send({
            type: "done",
            messageId,
            status,
            truncated,
            usage: { used: quota.used, limit: quota.limit },
          });
        }
      } catch (error) {
        await logError("chat.finalizar", error);
        send({ type: "error", code: "erro_interno", message: "Algo deu errado ao finalizar a resposta.", retryable: true });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          // conexão já encerrada pelo navegador
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no",
    },
  });
}

async function loadProject(supabase: Awaited<ReturnType<typeof createClient>>, projectId: string) {
  const [{ data: project }, { data: tasks }] = await Promise.all([
    supabase.from("projects").select("name, goal").eq("id", projectId).maybeSingle(),
    supabase
      .from("tasks")
      .select("title")
      .eq("project_id", projectId)
      .is("completed_at", null)
      .order("position", { ascending: true })
      .limit(15),
  ]);
  if (!project) return null;
  return {
    name: project.name as string,
    goal: project.goal as string,
    openTasks: (tasks ?? []).map((t) => t.title as string),
  };
}
