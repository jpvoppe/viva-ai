import type { ChatPart, ChatTurn } from "./types";

export type HistoryMessage = { role: "user" | "assistant"; content: string };

export type CurrentAttachment =
  | { kind: "documento"; name: string; text: string; truncated: boolean }
  | { kind: "imagem"; name: string; mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif"; dataBase64: string };

const MAX_HISTORY_MESSAGES = 30;

/**
 * Monta o que vai para o modelo: histórico recente (limitado por tamanho,
 * para controlar custo) + a mensagem atual com seus anexos.
 * Regras:
 *  - começa sempre por uma mensagem do usuário;
 *  - nunca manda duas mensagens seguidas do mesmo papel;
 *  - mensagens vazias (ex.: resposta que falhou) são descartadas.
 */
export function buildTurns(
  history: HistoryMessage[],
  current: { text: string; attachments: CurrentAttachment[] },
  limits: { contextChars: number; attachmentChars: number },
): ChatTurn[] {
  const picked: HistoryMessage[] = [];
  let budget = limits.contextChars;
  const recent = history.filter((m) => m.content.trim() !== "").slice(-MAX_HISTORY_MESSAGES);
  for (let i = recent.length - 1; i >= 0; i--) {
    const message = recent[i];
    if (message.content.length > budget) {
      // A mais antiga que couber parcialmente entra cortada; depois disso, para.
      if (budget > 400) {
        picked.unshift({ role: message.role, content: `[…] ${message.content.slice(-budget)}` });
      }
      break;
    }
    budget -= message.content.length;
    picked.unshift(message);
  }

  const turns: ChatTurn[] = [];
  for (const message of picked) {
    const last = turns.at(-1);
    if (last && last.role === message.role) {
      last.parts.push({ type: "text", text: message.content });
    } else {
      turns.push({ role: message.role, parts: [{ type: "text", text: message.content }] });
    }
  }
  while (turns.length > 0 && turns[0].role !== "user") turns.shift();

  const parts: ChatPart[] = [];
  let attachmentBudget = limits.attachmentChars;
  for (const attachment of current.attachments) {
    if (attachment.kind === "imagem") {
      parts.push({ type: "image", mediaType: attachment.mediaType, dataBase64: attachment.dataBase64 });
      continue;
    }
    const slice = attachment.text.slice(0, Math.max(attachmentBudget, 0));
    attachmentBudget -= slice.length;
    const cut = attachment.truncated || slice.length < attachment.text.length;
    parts.push({
      type: "text",
      text:
        `<arquivo nome="${attachment.name.replace(/"/g, "'")}"${cut ? ' parcial="sim"' : ""}>\n` +
        `${slice}\n</arquivo>`,
    });
  }
  parts.push({ type: "text", text: current.text });

  const last = turns.at(-1);
  if (last && last.role === "user") {
    last.parts.push(...parts);
  } else {
    turns.push({ role: "user", parts });
  }
  return turns;
}

/** Título da conversa a partir da primeira mensagem — sem gastar uma chamada de IA. */
export function titleFromMessage(text: string): string {
  const firstLine = text.replace(/\s+/g, " ").trim();
  if (!firstLine) return "Nova conversa";
  if (firstLine.length <= 60) return firstLine;
  const cut = firstLine.slice(0, 60);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 30 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
