import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignInForm } from "@/features/auth/auth-forms";
import { Skeleton } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Entrar", robots: { index: false } };

export default function Page() {
  return (
    <>
      <h1 className="text-3xl">Entrar no VIVA</h1>
      <p className="mb-8 mt-2 text-ink-soft">
        Ainda não tem conta?{" "}
        <Link href="/criar-conta" className="font-medium text-violet-text underline underline-offset-4">
          Criar conta gratuita
        </Link>
      </p>
      <Suspense fallback={<FormSkeleton rows={2} />}>
        <SignInForm />
      </Suspense>
    </>
  );
}

function FormSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-5">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-[4.5rem]" />
      ))}
      <Skeleton className="h-12" />
    </div>
  );
}
