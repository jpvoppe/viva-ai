/** Extrai os itens de listas com marcadores de um texto em Markdown. */
export function extractListItems(markdown: string): string[] {
  const items: string[] = [];
  for (const raw of markdown.split("\n")) {
    const match = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.+)$/.exec(raw);
    if (!match) continue;
    const text = match[1]
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/[*_`]/g, "")
      .trim();
    if (text && text.length <= 300) items.push(text);
  }
  return items.slice(0, 200);
}

/** Markdown → texto simples, para baixar como .txt. */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\w-]*\n?/g, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .trim();
}

export function slugify(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "viva"
  );
}

/** Baixa um texto como arquivo, direto do navegador. */
export function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
