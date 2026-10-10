"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, serverEnv } from "@/lib/env";
import { checkRateLimit, RATE_RULES } from "@/lib/limits/rate-limit";
import { clientFingerprint } from "@/lib/request";
import { logError } from "@/lib/log";
import { safeInternalPath } from "@/lib/utils";
import { ageBandFor, ageOn, emailSchema, MIN_AGE, passwordSchema, signInSchema, signUpSchema } from "./schema";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  notice?: string;
  values?: Record<string, string>;
};

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

const NOT_CONFIGURED: AuthFormState = {
  error: "O VIVA ainda não foi conectado ao banco de dados. Veja /configuracao-pendente.",
};
const TOO_MANY: AuthFormState = {
  error: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.",
};

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const values = { email: String(formData.get("email") ?? "") };
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error.issues), values };

  if (!(await checkRateLimit(`auth:${await clientFingerprint()}`, RATE_RULES.auth))) return TOO_MANY;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Confirme o seu e-mail antes de entrar. Procure a mensagem do VIVA na sua caixa de entrada.", values };
    }
    if (error.status === 400 || error.code === "invalid_credentials") {
      return { error: "E-mail ou senha incorretos.", values };
    }
    if (error.status === 429) return { ...TOO_MANY, values };
    await logError("auth.entrar", error, error.code);
    return { error: "Não foi possível entrar agora. Tente de novo em instantes.", values };
  }
  redirect(safeInternalPath(formData.get("voltar"), "/app"));
}

export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const values = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    birthDate: String(formData.get("birthDate") ?? ""),
  };
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    birthDate: formData.get("birthDate"),
    terms: formData.get("terms") ?? undefined,
    timezone: formData.get("timezone") ?? undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error.issues), values };

  const age = ageOn(parsed.data.birthDate);
  if (age === null) {
    return { fieldErrors: { birthDate: "Confira a data de nascimento." }, values };
  }
  const ageBand = ageBandFor(age);
  if (!ageBand) {
    return {
      error: `O VIVA é para pessoas a partir de ${MIN_AGE} anos. Peça a um responsável para usar com você.`,
      values,
    };
  }

  if (!(await checkRateLimit(`auth:${await clientFingerprint()}`, RATE_RULES.auth))) return TOO_MANY;

  const supabase = await createClient();
  const { data: flag } = await supabase.from("feature_flags").select("enabled").eq("key", "novos_cadastros").maybeSingle();
  if (flag && flag.enabled === false) {
    return { error: "A criação de novas contas está pausada no momento. Tente mais tarde.", values };
  }

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${serverEnv.siteUrl}/auth/callback?next=/app`,
      // A data de nascimento NÃO é enviada nem guardada: só a faixa etária.
      data: {
        display_name: parsed.data.name,
        age_band: ageBand,
        terms_accepted: "true",
        timezone: parsed.data.timezone ?? "America/Sao_Paulo",
      },
    },
  });
  if (error) {
    if (error.code === "user_already_exists" || /already registered/i.test(error.message)) {
      return { error: "Já existe uma conta com este e-mail. Entre ou recupere a senha.", values };
    }
    if (error.code === "weak_password") {
      return { fieldErrors: { password: "Escolha uma senha mais forte." }, values };
    }
    if (error.status === 429) return { ...TOO_MANY, values };
    await logError("auth.criar_conta", error, error.code);
    return { error: "Não foi possível criar a conta agora. Tente de novo em instantes.", values };
  }

  if (!data.session) {
    // Confirmação de e-mail ligada no Supabase (padrão em produção).
    return {
      notice: "Conta criada. Enviamos um link de confirmação para o seu e-mail — abra-o para começar a usar.",
    };
  }
  redirect("/app/boas-vindas");
}

export async function requestPasswordResetAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { fieldErrors: { email: parsed.error.issues[0]?.message ?? "E-mail inválido." } };
  }
  if (!(await checkRateLimit(`auth:${await clientFingerprint()}`, RATE_RULES.auth))) return TOO_MANY;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${serverEnv.siteUrl}/auth/callback?next=/redefinir-senha`,
  });
  if (error && error.status === 429) return TOO_MANY;
  if (error) await logError("auth.recuperar", error, error.code);
  // Mesma resposta exista ou não a conta, para não revelar quem tem cadastro.
  return {
    notice: "Se existir uma conta com este e-mail, enviamos um link para criar uma nova senha. Ele vale por tempo limitado.",
  };
}

export async function updatePasswordAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) {
    return { fieldErrors: { password: parsed.error.issues[0]?.message ?? "Senha inválida." } };
  }
  if (formData.get("password") !== formData.get("confirm")) {
    return { fieldErrors: { confirm: "As duas senhas precisam ser iguais." } };
  }
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: "O link expirou ou já foi usado. Peça um novo em “Esqueci minha senha”." };
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    if (error.code === "same_password") {
      return { fieldErrors: { password: "A nova senha precisa ser diferente da atual." } };
    }
    if (error.code === "weak_password") {
      return { fieldErrors: { password: "Escolha uma senha mais forte." } };
    }
    await logError("auth.nova_senha", error, error.code);
    return { error: "Não foi possível salvar a nova senha. Tente de novo." };
  }
  redirect("/app?aviso=senha-alterada");
}

export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/entrar?saiu=1");
}
