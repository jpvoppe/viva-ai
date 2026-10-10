import type { Metadata } from "next";
import Link from "next/link";
import { ResetRequestForm } from "@/features/auth/auth-forms";

export const metadata: Metadata = { title: "Recuperar senha", robots: { index: false } };

export default function Page() {
  return (
    <>
      <h1 className="text-3xl">Esqueceu a senha?</h1>
      <p className="mb-8 mt-2 text-ink-soft">
        Informe o e-mail da sua conta e enviaremos um link para você criar uma nova senha.
      </p>
      <ResetRequestForm />
      <p className="mt-6">
        <Link href="/entrar" className="text-violet-text underline underline-offset-4">
          Voltar para entrar
        </Link>
      </p>
    </>
  );
}
