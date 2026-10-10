import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Orb } from "@/components/orb/orb";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10 lg:px-14">
        <header>
          <Link href="/" aria-label="VIVA AI — página inicial" className="inline-flex rounded-md">
            <Logo />
          </Link>
        </header>
        <main id="conteudo" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          {children}
        </main>
        <footer className="text-sm text-ink-muted">
          <Link href="/privacidade" className="underline underline-offset-4 hover:text-ink">
            Privacidade
          </Link>
          <span aria-hidden="true" className="mx-2">
            /
          </span>
          <Link href="/termos" className="underline underline-offset-4 hover:text-ink">
            Termos de uso
          </Link>
        </footer>
      </div>

      <aside
        aria-hidden="true"
        className="relative hidden overflow-hidden bg-[#15131c] text-white lg:flex lg:flex-col lg:justify-end lg:p-14"
      >
        <div className="pointer-events-none absolute -right-24 -top-24 size-[32rem] rounded-full bg-[radial-gradient(circle,rgb(109_59_245/0.55),transparent_65%)]" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 size-[30rem] rounded-full bg-[radial-gradient(circle,rgb(31_107_255/0.4),transparent_65%)]" />
        <div className="absolute right-16 top-20">
          <Orb size={180} />
        </div>
        <p
          className="relative max-w-[14ch] font-display text-5xl font-semibold leading-[0.98] tracking-[-0.03em]"
          style={{ fontStretch: "82%" }}
        >
          O que vamos resolver hoje?
        </p>
        <p className="relative mt-5 max-w-[38ch] text-lg text-white/75">
          Estudar, organizar a semana, escrever, planejar. Você diz o que precisa; o VIVA ajuda a chegar lá.
        </p>
      </aside>
    </div>
  );
}
