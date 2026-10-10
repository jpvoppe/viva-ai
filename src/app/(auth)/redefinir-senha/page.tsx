import type { Metadata } from "next";
import { NewPasswordForm } from "@/features/auth/auth-forms";

export const metadata: Metadata = { title: "Nova senha", robots: { index: false } };

export default function Page() {
  return (
    <>
      <h1 className="text-3xl">Crie uma nova senha</h1>
      <p className="mb-8 mt-2 text-ink-soft">Depois de salvar, você já entra no VIVA com a senha nova.</p>
      <NewPasswordForm />
    </>
  );
}
