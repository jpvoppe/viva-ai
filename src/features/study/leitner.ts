/**
 * Repetição espaçada simples (sistema de Leitner, 5 caixas).
 * Acertou: sobe uma caixa e demora mais para voltar. Errou: volta para a caixa 1.
 */
export const BOX_INTERVAL_DAYS = [0, 1, 2, 4, 8, 16] as const; // índice = caixa
const RETRY_MINUTES = 10;

export function nextReview(box: number, correct: boolean, now: Date = new Date()): { box: number; dueAt: Date } {
  if (!correct) {
    return { box: 1, dueAt: new Date(now.getTime() + RETRY_MINUTES * 60_000) };
  }
  const nextBox = Math.min(Math.max(box, 1) + 1, 5);
  return { box: nextBox, dueAt: new Date(now.getTime() + BOX_INTERVAL_DAYS[nextBox] * 86_400_000) };
}
