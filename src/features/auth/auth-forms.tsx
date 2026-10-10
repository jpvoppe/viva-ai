"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, fieldAria, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import {
  requestPasswordResetAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
  type AuthFormState,
} from "./actions";

const initial: AuthFormState = {};

function PasswordInput({
  id,
  name,
  autoComplete,
  error,
  hasHint,
}: {
  id: string;
  name: string;
  autoComplete: "current-password" | "new-password";
  error?: string;
  hasHint?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        {...fieldAria(id, error, hasHint)}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required
        maxLength={72}
        className="pr-12"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visible}
        className="absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-md text-ink-muted hover:text-ink"
      >
        {visible ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
      </button>
    </div>
  );
}

export function SignInForm() {
  const [state, action, pending] = useActionState(signInAction, initial);
  const params = useSearchParams();
  const back = params.get("voltar") ?? "";
  const signedOut = params.get("saiu") === "1";
  const linkError = params.get("erro") === "link";
  const profileError = params.get("erro") === "perfil";

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="voltar" value={back} />
      {signedOut && !state.error ? <Alert tone="sucesso" title="Você saiu da sua conta." /> : null}
      {linkError && !state.error ? (
        <Alert tone="erro" title="Este link expirou ou já foi usado.">
          Entre com a sua senha ou peça um novo link em “Esqueci minha senha”.
        </Alert>
      ) : null}
      {profileError && !state.error ? (
        <Alert tone="erro" title="Não conseguimos carregar o seu perfil.">
          Entre de novo. Se continuar, fale com o suporte.
        </Alert>
      ) : null}
      {state.error ? <Alert tone="erro" title={state.error} /> : null}

      <Field id="email" label="E-mail" error={state.fieldErrors?.email}>
        <Input
          {...fieldAria("email", state.fieldErrors?.email)}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={state.values?.email}
        />
      </Field>
      <Field id="password" label="Senha" error={state.fieldErrors?.password}>
        <PasswordInput id="password" name="password" autoComplete="current-password" error={state.fieldErrors?.password} />
      </Field>
      <div className="-mt-2 text-right">
        <Link href="/recuperar-senha" className="text-sm text-violet-text underline underline-offset-4">
          Esqueci minha senha
        </Link>
      </div>
      <Button type="submit" size="lg" loading={pending} loadingLabel="Entrando">
        Entrar
      </Button>
    </form>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, initial);
  const [timezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "America/Sao_Paulo";
    }
  });

  if (state.notice) {
    return (
      <Alert tone="sucesso" title="Quase lá!">
        {state.notice}
      </Alert>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="timezone" value={timezone} suppressHydrationWarning />
      {state.error ? <Alert tone="erro" title={state.error} /> : null}

      <Field id="name" label="Como quer ser chamado?" error={state.fieldErrors?.name}>
        <Input
          {...fieldAria("name", state.fieldErrors?.name)}
          name="name"
          autoComplete="given-name"
          required
          maxLength={80}
          defaultValue={state.values?.name}
        />
      </Field>
      <Field id="email" label="E-mail" error={state.fieldErrors?.email}>
        <Input
          {...fieldAria("email", state.fieldErrors?.email)}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={state.values?.email}
        />
      </Field>
      <Field
        id="password"
        label="Crie uma senha"
        hint="Pelo menos 8 caracteres, com letras e números."
        error={state.fieldErrors?.password}
      >
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          error={state.fieldErrors?.password}
          hasHint
        />
      </Field>
      <Field
        id="birthDate"
        label="Data de nascimento"
        hint="Usamos só para adequar a experiência à sua idade. A data não fica guardada."
        error={state.fieldErrors?.birthDate}
      >
        <Input
          {...fieldAria("birthDate", state.fieldErrors?.birthDate, true)}
          name="birthDate"
          type="date"
          autoComplete="bday"
          required
          min="1900-01-01"
          defaultValue={state.values?.birthDate}
        />
      </Field>
      <div>
        <Checkbox
          id="terms"
          name="terms"
          required
          aria-invalid={state.fieldErrors?.terms ? true : undefined}
          aria-describedby={state.fieldErrors?.terms ? "terms-erro" : undefined}
          label={
            <>
              Li e aceito os{" "}
              <Link href="/termos" target="_blank" className="text-violet-text underline underline-offset-4">
                Termos de uso
              </Link>{" "}
              e a{" "}
              <Link href="/privacidade" target="_blank" className="text-violet-text underline underline-offset-4">
                Política de privacidade
              </Link>
              .
            </>
          }
        />
        {state.fieldErrors?.terms ? (
          <p id="terms-erro" role="alert" className="text-sm text-danger">
            {state.fieldErrors.terms}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="lg" loading={pending} loadingLabel="Criando a conta">
        Criar conta gratuita
      </Button>
    </form>
  );
}

export function ResetRequestForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initial);
  if (state.notice) {
    return (
      <Alert tone="sucesso" title="Confira o seu e-mail">
        {state.notice}
      </Alert>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.error ? <Alert tone="erro" title={state.error} /> : null}
      <Field id="email" label="E-mail da sua conta" error={state.fieldErrors?.email}>
        <Input
          {...fieldAria("email", state.fieldErrors?.email)}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
      </Field>
      <Button type="submit" size="lg" loading={pending} loadingLabel="Enviando">
        Enviar link de recuperação
      </Button>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, initial);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.error ? (
        <Alert
          tone="erro"
          title={state.error}
          action={
            <Link href="/recuperar-senha" className="font-medium text-violet-text underline underline-offset-4">
              Pedir novo link
            </Link>
          }
        />
      ) : null}
      <Field
        id="password"
        label="Nova senha"
        hint="Pelo menos 8 caracteres, com letras e números."
        error={state.fieldErrors?.password}
      >
        <PasswordInput id="password" name="password" autoComplete="new-password" error={state.fieldErrors?.password} hasHint />
      </Field>
      <Field id="confirm" label="Repita a nova senha" error={state.fieldErrors?.confirm}>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" error={state.fieldErrors?.confirm} />
      </Field>
      <Button type="submit" size="lg" loading={pending} loadingLabel="Salvando">
        Salvar nova senha
      </Button>
    </form>
  );
}
