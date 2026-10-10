"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, FileUp, Lock, Mic } from "lucide-react";
import { Orb } from "@/components/orb/orb";
import { useTheme } from "@/components/theme/theme-provider";
import { Button } from "@/components/ui/button";
import { Field, fieldAria, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { Switch } from "@/components/ui/switch";
import { completeOnboardingAction } from "@/features/settings/actions";
import { GOAL_OPTIONS } from "@/features/settings/options";
import { getPlan } from "@/lib/plans";
import { cn } from "@/lib/utils";
import type { ResponseStyle, ThemePreference } from "@/lib/types";

const STYLE_OPTIONS: { id: ResponseStyle; label: string; description: string }[] = [
  { id: "direto", label: "Direto", description: "Respostas curtas, direto ao ponto." },
  { id: "equilibrado", label: "Equilibrado", description: "Curto quando dá, completo quando precisa." },
  { id: "detalhado", label: "Detalhado", description: "Explicações passo a passo, com exemplos." },
];

const THEME_OPTIONS: { id: ThemePreference; label: string }[] = [
  { id: "sistema", label: "Igual ao aparelho" },
  { id: "claro", label: "Claro" },
  { id: "escuro", label: "Escuro" },
];

function OptionCard({
  selected,
  onClick,
  label,
  description,
  multi,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  description?: string;
  multi?: boolean;
}) {
  return (
    <button
      type="button"
      role={multi ? "checkbox" : "radio"}
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "flex min-h-12 w-full items-center justify-between gap-3 rounded-md border px-4 py-2.5 text-left transition-colors",
        selected ? "border-violet bg-tint" : "border-line-strong bg-surface hover:border-ink-muted",
      )}
    >
      <span>
        <span className="block font-medium text-ink">{label}</span>
        {description ? <span className="block text-sm text-ink-soft">{description}</span> : null}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "flex size-5 shrink-0 items-center justify-center border-2",
          multi ? "rounded-[6px]" : "rounded-full",
          selected ? "border-violet bg-violet text-white" : "border-line-strong",
        )}
      >
        {selected ? <Check className="size-3" strokeWidth={4} /> : null}
      </span>
    </button>
  );
}

export function OnboardingFlow({ name, needsAge }: { name: string; needsAge: boolean }) {
  const router = useRouter();
  const theme = useTheme();
  const free = getPlan("gratuito").limits;
  const steps = ["ola", "objetivos", "preferencias", "privacidade"] as const;
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState<string[]>([]);
  const [style, setStyle] = useState<ResponseStyle>("equilibrado");
  const [memory, setMemory] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async () => {
    setPending(true);
    setError(null);
    let timezone: string | undefined;
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      timezone = undefined;
    }
    const result = await completeOnboardingAction({
      goals,
      theme: theme.preference,
      response_style: style,
      memory_enabled: memory,
      timezone,
      birthDate: birthDate || undefined,
    });
    if (!result.ok) {
      setPending(false);
      setError(result.error);
      if (needsAge) setStep(0);
      return;
    }
    router.replace("/app");
    router.refresh();
  };

  const canSkip = !needsAge || Boolean(birthDate);
  const last = step === steps.length - 1;
  const next = () => (last ? void finish() : setStep((s) => s + 1));

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-6">
      <div className="flex items-center justify-between">
        <div
          className="flex gap-1.5"
          role="progressbar"
          aria-label="Etapas do primeiro acesso"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={step + 1}
          aria-valuetext={`Etapa ${step + 1} de ${steps.length}`}
        >
          {steps.map((id, index) => (
            <span
              key={id}
              className={cn("h-1.5 w-8 rounded-full transition-colors duration-300", index <= step ? "bg-violet" : "bg-line-strong")}
            />
          ))}
        </div>
        {canSkip ? (
          <Button variant="ghost" size="sm" onClick={() => void finish()} disabled={pending}>
            Pular e entrar no VIVA
          </Button>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col justify-center py-8">
        {error ? <Alert tone="erro" title={error} className="mb-6" /> : null}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={steps[step]}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {steps[step] === "ola" ? (
              <div>
                <Orb size={72} />
                <h1 className="mt-6 text-3xl sm:text-4xl" style={{ fontStretch: "88%" }}>
                  {name ? `Olá, ${name}.` : "Olá."} Eu sou o VIVA.
                </h1>
                <p className="mt-3 text-lg text-ink-soft">
                  Um assistente para o seu dia a dia: explico o que você não entendeu, organizo tarefas, ajudo a
                  escrever e a tirar ideias do papel.
                </p>
                <ul className="mt-6 flex flex-col gap-2 text-ink-soft">
                  <li>
                    No plano Gratuito você tem {free.dailyMessages} mensagens por dia, {free.dailyGenerations} criações
                    nas ferramentas e {free.dailyFiles} arquivos.
                  </li>
                  <li>Organizador, projetos e histórico não têm limite de uso.</li>
                  <li>Limites maiores e respostas mais longas fazem parte do VIVA Plus.</li>
                </ul>
                {needsAge ? (
                  <Field
                    id="nascimento"
                    label="Data de nascimento"
                    hint="Usamos só para adequar a experiência à sua idade. A data não fica guardada."
                    className="mt-6"
                  >
                    <Input
                      {...fieldAria("nascimento", null, true)}
                      type="date"
                      value={birthDate}
                      onChange={(event) => setBirthDate(event.target.value)}
                      min="1900-01-01"
                      required
                    />
                  </Field>
                ) : null}
              </div>
            ) : null}

            {steps[step] === "objetivos" ? (
              <div>
                <h1 className="text-3xl">Para que você quer usar o VIVA?</h1>
                <p className="mt-2 text-ink-soft">Opcional. Serve para sugerir atalhos na tela inicial.</p>
                <div className="mt-6 grid gap-2 sm:grid-cols-2" role="group" aria-label="Objetivos">
                  {GOAL_OPTIONS.map((goal) => (
                    <OptionCard
                      key={goal.id}
                      multi
                      label={goal.label}
                      selected={goals.includes(goal.id)}
                      onClick={() =>
                        setGoals((current) =>
                          current.includes(goal.id) ? current.filter((g) => g !== goal.id) : [...current, goal.id],
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {steps[step] === "preferencias" ? (
              <div>
                <h1 className="text-3xl">Do seu jeito</h1>
                <p className="mt-2 text-ink-soft">Você pode mudar tudo isso depois, em Configurações.</p>
                <h2 className="mb-2 mt-6 font-sans text-base font-semibold tracking-normal">Aparência</h2>
                <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Aparência">
                  {THEME_OPTIONS.map((option) => (
                    <OptionCard
                      key={option.id}
                      label={option.label}
                      selected={theme.preference === option.id}
                      onClick={() => theme.setPreference(option.id)}
                    />
                  ))}
                </div>
                <h2 className="mb-2 mt-6 font-sans text-base font-semibold tracking-normal">Estilo das respostas</h2>
                <div className="grid gap-2" role="radiogroup" aria-label="Estilo das respostas">
                  {STYLE_OPTIONS.map((option) => (
                    <OptionCard
                      key={option.id}
                      label={option.label}
                      description={option.description}
                      selected={style === option.id}
                      onClick={() => setStyle(option.id)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {steps[step] === "privacidade" ? (
              <div>
                <h1 className="text-3xl">Seus dados, suas regras</h1>
                <ul className="mt-6 flex flex-col gap-4">
                  <li className="flex gap-3">
                    <Lock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-violet-text" />
                    <p className="text-ink-soft">
                      <span className="font-medium text-ink">Conversas, tarefas e projetos são só seus.</span> Suas
                      mensagens são enviadas ao provedor de IA apenas para gerar a resposta. Você pode exportar ou
                      apagar tudo quando quiser.
                    </p>
                  </li>
                  <li className="flex gap-3">
                    <Mic aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-violet-text" />
                    <p className="text-ink-soft">
                      <span className="font-medium text-ink">Microfone só quando você tocar no botão de ditar.</span>{" "}
                      O navegador pede a sua permissão e faz a transcrição.
                    </p>
                  </li>
                  <li className="flex gap-3">
                    <FileUp aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-violet-text" />
                    <p className="text-ink-soft">
                      <span className="font-medium text-ink">Arquivos ficam em área privada.</span> Só você abre o que
                      enviou.
                    </p>
                  </li>
                </ul>
                <div className="mt-6 rounded-lg border border-line bg-surface px-4">
                  <Switch
                    id="memoria"
                    label="Ativar a memória personalizada"
                    description="O VIVA passa a usar preferências que você mandar guardar (ex.: “prefiro respostas em tópicos”). Nada é guardado sem você pedir, e dá para ver, editar e apagar tudo."
                    checked={memory}
                    onCheckedChange={setMemory}
                  />
                </div>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between gap-3 pb-safe">
        {step > 0 ? (
          <Button variant="secondary" onClick={() => setStep((s) => s - 1)} disabled={pending}>
            Voltar
          </Button>
        ) : (
          <span />
        )}
        <Button size="lg" onClick={next} loading={pending} loadingLabel="Entrando" disabled={step === 0 && needsAge && !birthDate}>
          {last ? "Entrar no VIVA" : "Avançar"}
        </Button>
      </div>
    </div>
  );
}
