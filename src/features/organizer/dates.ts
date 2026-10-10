import { addDays, addMonths } from "@/lib/utils";
import type { Recurrence } from "@/lib/types";

/** Próxima data de uma tarefa que se repete, sempre no futuro em relação a hoje. */
export function nextOccurrence(recurrence: Recurrence, dueDate: string | null, today: string): string | null {
  if (recurrence === "nenhuma") return null;
  let next = dueDate ?? today;
  const step = (date: string) =>
    recurrence === "diaria" ? addDays(date, 1) : recurrence === "semanal" ? addDays(date, 7) : addMonths(date, 1);
  next = step(next);
  let guard = 0;
  while (next <= today && guard < 400) {
    next = step(next);
    guard++;
  }
  return next;
}

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d, weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = parts(fromIso);
  const b = parts(toIso);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

/** "Hoje", "Amanhã", "Ontem", "quinta", "12 de mar" — relativo ao dia do usuário. */
export function describeDueDate(due: string, today: string): string {
  const diff = daysBetween(today, due);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff === -1) return "Ontem";
  const p = parts(due);
  if (diff > 1 && diff < 7) return WEEKDAYS[p.weekday];
  const sameYear = p.y === parts(today).y;
  return `${p.d} de ${MONTHS_SHORT[p.m - 1]}${sameYear ? "" : ` de ${p.y}`}`;
}

export function formatLongDate(iso: string): string {
  const p = parts(iso);
  return `${WEEKDAYS[p.weekday]}, ${p.d} de ${MONTHS[p.m - 1]}`;
}

export function weekdayOf(iso: string): number {
  return parts(iso).weekday;
}
