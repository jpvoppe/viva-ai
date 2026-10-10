import { Orb } from "@/components/orb/orb";

/** Entrada do app: o Pulso aparece enquanto a sessão é conferida. Curta, sem enrolação. */
export function AppLoading() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5" role="status" aria-live="polite">
      <div className="animate-pop">
        <Orb size={72} state="pensando" />
      </div>
      <p
        className="animate-fade-in font-display text-2xl font-bold tracking-[-0.04em] text-ink"
        style={{ fontStretch: "88%", animationDelay: "120ms" }}
      >
        viva
      </p>
      <span className="sr-only">Abrindo o VIVA…</span>
    </div>
  );
}
