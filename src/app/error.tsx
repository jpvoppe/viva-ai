"use client";

import { useEffect } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Orb } from "@/components/orb/orb";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[viva] erro na página", error.digest ?? error.message);
  }, [error]);

  return (
    <main id="conteudo" className="mx-auto flex min-h-[70dvh] max-w-xl flex-col justify-center px-5 py-12">
      <Orb size={56} state="erro" />
      <h1 className="mt-6 text-3xl">Algo deu errado ao abrir esta página</h1>
      <p className="mt-3 text-lg text-ink-soft">
        O problema foi do nosso lado, não seu. Seus dados continuam salvos. Tente de novo; se continuar, volte ao
        início.
      </p>
      {error.digest ? <p className="mt-2 text-sm text-ink-muted">Código para o suporte: {error.digest}</p> : null}
      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={reset}>Tentar de novo</Button>
        <LinkButton href="/app" variant="secondary">
          Ir para o início
        </LinkButton>
      </div>
    </main>
  );
}
