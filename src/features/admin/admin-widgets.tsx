"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { setFeatureFlagAction } from "./actions";
import { formatUsd } from "./format";

export type DailyUsage = {
  dia: string;
  chamadas: number;
  tokens_entrada: number;
  tokens_saida: number;
  custo_micro_usd: number;
  usuarios: number;
};

function shortDay(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/**
 * Chamadas de IA por dia: uma série, uma cor, barras finas com topo arredondado,
 * grade discreta, valor no toque/hover e tabela completa logo abaixo.
 */
export function DailyCallsChart({ data }: { data: DailyUsage[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.chamadas));
  const ticks = [max, Math.round(max / 2), 0];
  const current = active !== null ? data[active] : null;

  return (
    <figure>
      <figcaption className="mb-2 flex min-h-12 flex-wrap items-baseline justify-between gap-x-4">
        <span className="font-medium">Chamadas de IA por dia</span>
        <span className="text-sm text-ink-muted" aria-live="polite">
          {current
            ? `${shortDay(current.dia)}: ${current.chamadas} chamadas, ${current.usuarios} usuários, ${formatUsd(current.custo_micro_usd)}`
            : "Passe o cursor ou toque em uma barra para ver o dia."}
        </span>
      </figcaption>
      <div className="flex gap-2">
        <div aria-hidden="true" className="flex h-40 flex-col justify-between text-right text-sm tabular-nums text-ink-muted">
          {ticks.map((tick, index) => (
            <span key={index} className="leading-none">
              {tick}
            </span>
          ))}
        </div>
        <div className="relative h-40 flex-1">
          <div aria-hidden="true" className="absolute inset-0 flex flex-col justify-between">
            <span className="border-t border-line" />
            <span className="border-t border-dashed border-line" />
            <span className="border-t border-line-strong" />
          </div>
          <ul className="absolute inset-0 flex items-end gap-[2px]" aria-label="Barras de chamadas por dia">
            {data.map((day, index) => (
              <li key={day.dia} className="flex h-full flex-1 items-end">
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  onClick={() => setActive(index)}
                  aria-label={`${shortDay(day.dia)}: ${day.chamadas} chamadas`}
                  className="group flex h-full w-full items-end justify-center rounded-sm"
                >
                  <span
                    className={cn(
                      "block w-full max-w-6 origin-bottom rounded-t-[4px] bg-violet transition-[opacity,transform] duration-500 ease-out",
                      "animate-[bar-grow_600ms_var(--e-out)_both]",
                      active !== null && active !== index ? "opacity-45" : "opacity-100",
                    )}
                    style={{
                      height: `${day.chamadas === 0 ? 0 : Math.max((day.chamadas / max) * 100, 2)}%`,
                      animationDelay: `${index * 18}ms`,
                    }}
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div aria-hidden="true" className="ml-8 mt-1 flex justify-between text-sm tabular-nums text-ink-muted">
        <span>{data[0] ? shortDay(data[0].dia) : ""}</span>
        <span>{data.at(-1) ? shortDay((data.at(-1) as DailyUsage).dia) : ""}</span>
      </div>
      <style>{`@keyframes bar-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }`}</style>
    </figure>
  );
}

export type Flag = { key: string; enabled: boolean; description: string };

export function FeatureFlags({ flags: initial }: { flags: Flag[] }) {
  const toast = useToast();
  const [flags, setFlags] = useState(initial);

  const toggle = async (key: string, enabled: boolean) => {
    setFlags((list) => list.map((f) => (f.key === key ? { ...f, enabled } : f)));
    const result = await setFeatureFlagAction({ key, enabled });
    if (!result.ok) {
      setFlags((list) => list.map((f) => (f.key === key ? { ...f, enabled: !enabled } : f)));
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Recurso atualizado.");
  };

  return (
    <div className="divide-y divide-line">
      {flags.map((flag) => (
        <Switch
          key={flag.key}
          id={`recurso-${flag.key}`}
          label={flag.description || flag.key}
          description={`Chave: ${flag.key}`}
          checked={flag.enabled}
          onCheckedChange={(checked) => void toggle(flag.key, checked)}
        />
      ))}
    </div>
  );
}
