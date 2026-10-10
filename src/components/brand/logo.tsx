import { Orb } from "@/components/orb/orb";
import { cn } from "@/lib/utils";

/** Marca do VIVA: o Pulso + o nome em letras de display. */
export function Logo({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const orb = size === "sm" ? 22 : size === "md" ? 28 : 40;
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Orb size={orb} />
      <span
        className={cn(
          "font-display font-bold leading-none tracking-[-0.04em] text-ink",
          size === "sm" && "text-lg",
          size === "md" && "text-xl",
          size === "lg" && "text-3xl",
        )}
        style={{ fontStretch: "88%" }}
      >
        viva
      </span>
    </span>
  );
}
