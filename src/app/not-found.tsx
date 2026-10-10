import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5 py-12">
      <Link href="/" aria-label="VIVA AI — página inicial" className="self-start rounded-md">
        <Logo />
      </Link>
      <h1 className="mt-10 text-4xl" style={{ fontStretch: "86%" }}>
        Esta página não existe
      </h1>
      <p className="mt-3 text-lg text-ink-soft">
        O endereço pode estar errado, ou o conteúdo foi apagado. Se era uma conversa, um projeto ou uma criação, ele
        não está mais disponível nesta conta.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <LinkButton href="/app">Ir para o início do app</LinkButton>
        <LinkButton href="/" variant="secondary">
          Página inicial do site
        </LinkButton>
      </div>
    </main>
  );
}
