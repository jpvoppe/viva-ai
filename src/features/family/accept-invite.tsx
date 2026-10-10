"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { acceptFamilyInviteAction } from "./actions";

export function AcceptInvite({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <Alert tone="sucesso" title="Você entrou no plano Família." action={<LinkButton href="/app">Ir para o início</LinkButton>}>
        Os novos limites já valem para a sua conta.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col items-start gap-4">
      {error ? <Alert tone="erro" title={error} /> : null}
      <p className="text-ink-soft">
        Você está entrando como <span className="font-medium text-ink">{email}</span>.
      </p>
      <Button
        size="lg"
        loading={pending}
        loadingLabel="Entrando na família"
        onClick={async () => {
          setPending(true);
          setError(null);
          const result = await acceptFamilyInviteAction({ token });
          setPending(false);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setDone(true);
          router.refresh();
        }}
      >
        Aceitar convite
      </Button>
    </div>
  );
}
