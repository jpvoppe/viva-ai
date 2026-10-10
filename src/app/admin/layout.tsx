import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Painel administrativo", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <span className="rounded-full bg-sunken px-2.5 py-0.5 text-sm text-ink-soft">Administração</span>
        </div>
        <Link href="/app" className="text-sm font-medium text-violet-text underline underline-offset-4">
          Voltar ao app
        </Link>
      </header>
      <main id="conteudo" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
