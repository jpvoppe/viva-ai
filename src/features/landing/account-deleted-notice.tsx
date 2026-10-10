"use client";

import { useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/feedback";

export function AccountDeletedNotice() {
  const params = useSearchParams();
  if (params.get("conta") !== "excluida") return null;
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
      <Alert tone="sucesso" title="Sua conta e os seus dados foram excluídos.">
        Obrigado por ter usado o VIVA.
      </Alert>
    </div>
  );
}
