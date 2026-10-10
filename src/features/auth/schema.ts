import { z } from "zod";

export const MIN_AGE = 13;
export const ADULT_AGE = 18;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Informe o seu e-mail.")
  .max(254, "E-mail muito longo.")
  .email("Este e-mail não parece válido. Confira se digitou certo.");

export const passwordSchema = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .max(72, "A senha pode ter no máximo 72 caracteres.")
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Use letras e pelo menos um número na senha.");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe a sua senha.").max(72),
});

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Informe como quer ser chamado.").max(80, "Nome muito longo."),
  email: emailSchema,
  password: passwordSchema,
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a sua data de nascimento."),
  terms: z.literal("on", { error: "Para criar a conta, é preciso aceitar os termos." }),
  timezone: z.string().max(64).optional(),
});

/** Idade em anos completos na data de referência. */
export function ageOn(birthIso: string, today: Date = new Date()): number | null {
  const [y, m, d] = birthIso.split("-").map(Number);
  const birth = new Date(Date.UTC(y, m - 1, d));
  if (birth.getUTCFullYear() !== y || birth.getUTCMonth() !== m - 1 || birth.getUTCDate() !== d) return null;
  let age = today.getUTCFullYear() - y;
  const beforeBirthday =
    today.getUTCMonth() < m - 1 || (today.getUTCMonth() === m - 1 && today.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  if (age < 0 || age > 120) return null;
  return age;
}

export function ageBandFor(age: number): "adulto" | "adolescente" | null {
  if (age < MIN_AGE) return null;
  return age >= ADULT_AGE ? "adulto" : "adolescente";
}
