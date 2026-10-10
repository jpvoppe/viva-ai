import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { LinkButton } from "@/components/ui/button";
import { site } from "@/lib/site";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="VIVA AI — página inicial" className="rounded-md">
            <Logo />
          </Link>
          <nav aria-label="Principal" className="flex items-center gap-1 sm:gap-2">
            <Link href="/planos" className="hidden min-h-11 items-center rounded-md px-3 text-ink-soft hover:text-ink sm:inline-flex">
              Planos
            </Link>
            <Link href="/entrar" className="inline-flex min-h-11 items-center rounded-md px-3 text-ink-soft hover:text-ink">
              Entrar
            </Link>
            <LinkButton href="/criar-conta" size="sm" className="min-h-10">
              Criar conta
            </LinkButton>
          </nav>
        </div>
      </header>

      <main id="conteudo" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
          <div>
            <Logo size="sm" />
            <p className="mt-3 max-w-xs text-sm text-ink-muted">O assistente inteligente para a vida cotidiana.</p>
          </div>
          <nav aria-label="Rodapé" className="flex flex-wrap gap-x-6 gap-y-2 text-ink-soft">
            <Link href="/planos" className="underline-offset-4 hover:underline">
              Planos
            </Link>
            <Link href="/privacidade" className="underline-offset-4 hover:underline">
              Privacidade
            </Link>
            <Link href="/termos" className="underline-offset-4 hover:underline">
              Termos de uso
            </Link>
            {site.contactEmail ? (
              <a href={`mailto:${site.contactEmail}`} className="underline-offset-4 hover:underline">
                Contato
              </a>
            ) : null}
          </nav>
        </div>
        {site.company ? (
          <p className="mx-auto w-full max-w-6xl px-4 pb-8 text-sm text-ink-muted sm:px-6">
            {site.company}
            {site.companyId ? `, CNPJ ${site.companyId}` : ""}
          </p>
        ) : null}
      </footer>
    </div>
  );
}
