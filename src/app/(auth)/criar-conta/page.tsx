import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/features/auth/auth-forms";

export const metadata: Metadata = {
  title: "Criar conta",
  description: "Crie a sua conta gratuita no VIVA AI e comece a usar em menos de um minuto.",
};

export default function Page() {
  return (
    <>
      <h1 className="text-3xl">Criar a sua conta</h1>
      <p className="mb-8 mt-2 text-ink-soft">
        Gratuita para começar, sem cartão. Já tem conta?{" "}
        <Link href="/entrar" className="font-medium text-violet-text underline underline-offset-4">
          Entrar
        </Link>
      </p>
      <SignUpForm />
    </>
  );
}
