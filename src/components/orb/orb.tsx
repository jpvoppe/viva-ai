import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type OrbState = "parado" | "pensando" | "pesquisando" | "criando" | "concluido" | "erro" | "ouvindo";

const LABELS: Record<OrbState, string> = {
  parado: "",
  pensando: "Pensando",
  pesquisando: "Pesquisando",
  criando: "Escrevendo a resposta",
  concluido: "Concluído",
  erro: "Ocorreu um erro",
  ouvindo: "Ouvindo",
};

export function orbLabel(state: OrbState): string {
  return LABELS[state];
}

/**
 * O Pulso do VIVA. Fica parado quando nada acontece e só se move
 * para refletir um estado real do sistema (pensando, pesquisando, criando…).
 */
export function Orb({
  state = "parado",
  size = 40,
  level,
  className,
  decorative = true,
}: {
  state?: OrbState;
  size?: number;
  /** Volume do microfone (0 a 1) quando está ouvindo. */
  level?: number;
  className?: string;
  decorative?: boolean;
}) {
  const label = LABELS[state];
  return (
    <span
      className={cn("orb", className)}
      data-state={state}
      style={{ "--orb-size": `${size}px`, "--orb-level": level ?? 0 } as CSSProperties}
      role={decorative || !label ? undefined : "img"}
      aria-label={decorative || !label ? undefined : label}
      aria-hidden={decorative ? true : undefined}
    >
      <span className="orb__ring" />
      <span className="orb__body">
        <span className="orb__swirl" />
      </span>
    </span>
  );
}
