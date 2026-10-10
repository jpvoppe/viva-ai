/**
 * Extrai o primeiro valor JSON (objeto ou lista) de um texto de modelo,
 * tolerando cercas de código e comentários antes/depois.
 */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // segue para a busca por delimitadores
  }
  const start = cleaned.search(/[[{]/);
  if (start < 0) throw new Error("Nenhum JSON encontrado na resposta.");
  const open = cleaned[start];
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        return JSON.parse(cleaned.slice(start, i + 1));
      }
    }
  }
  throw new Error("JSON incompleto na resposta.");
}
