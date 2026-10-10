"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { ArrowUp, Paperclip } from "lucide-react";
import { Orb, type OrbState } from "@/components/orb/orb";

const QUESTION = "Tenho prova de história na sexta e só estudo à noite. Monta um plano de 4 dias?";
const ANSWER_LINES = [
  "Dá para organizar em 4 noites de cerca de 1 hora:",
  "Segunda: leia o resumo do capítulo e marque o que não entendeu.",
  "Terça: eu explico os pontos marcados e você refaz com as suas palavras.",
  "Quarta: 15 cartões de revisão sobre datas e conceitos.",
  "Quinta: um questionário de 10 perguntas para ver o que ainda falta.",
];

/**
 * Demonstração ILUSTRATIVA da tela de conversa (o texto é fixo, não vem da IA).
 * Toca uma única vez; quem prefere menos movimento vê o resultado final direto.
 */
export function HeroDemo() {
  const reduced = useReducedMotion();
  const [typed, setTyped] = useState(0);
  const [lines, setLines] = useState(0);
  const [phase, setPhase] = useState<OrbState>("parado");

  useEffect(() => {
    if (reduced) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(() => !cancelled && fn(), ms));

    for (let i = 1; i <= QUESTION.length; i++) at(600 + i * 22, () => setTyped(i));
    const sent = 600 + QUESTION.length * 22 + 350;
    at(sent, () => setPhase("pensando"));
    at(sent + 1100, () => setPhase("criando"));
    ANSWER_LINES.forEach((_, index) => at(sent + 1300 + index * 420, () => setLines(index + 1)));
    at(sent + 1300 + ANSWER_LINES.length * 420 + 200, () => setPhase("concluido"));
    at(sent + 1300 + ANSWER_LINES.length * 420 + 1200, () => setPhase("parado"));
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [reduced]);

  const shownTyped = reduced ? QUESTION.length : typed;
  const shownLines = reduced ? ANSWER_LINES.length : lines;
  const asked = shownTyped >= QUESTION.length && (reduced || phase !== "parado" || shownLines > 0);

  return (
    <figure className="relative mx-auto w-full max-w-xl">
      <div className="rounded-xl border border-white/12 bg-[#1c1926]/90 p-4 text-[#f4f2fa] shadow-[0_40px_80px_-24px_rgb(0_0_0/0.7)] backdrop-blur sm:p-5">
        <div className="flex min-h-[19rem] flex-col gap-4" aria-hidden="true">
          {asked ? (
            <p className="max-w-[85%] self-end rounded-lg rounded-br-sm bg-[#33295a] px-3.5 py-2.5">{QUESTION}</p>
          ) : null}
          {asked ? (
            <div className="flex gap-3">
              <span className="pt-0.5">
                <Orb size={24} state={phase} />
              </span>
              <div className="min-w-0 flex-1 space-y-2 text-[#d9d5e6]">
                {shownLines === 0 ? <p className="text-[#9a94ad]">Pensando…</p> : null}
                {ANSWER_LINES.slice(0, shownLines).map((line) => (
                  <p key={line} className="animate-fade-in">
                    {line}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-auto rounded-lg border border-white/14 bg-[#15131c] p-3">
            <p className="min-h-12 text-[#f4f2fa]">
              {asked ? <span className="text-[#9a94ad]">Escreva a sua mensagem</span> : QUESTION.slice(0, shownTyped)}
              {!asked ? <span className="ml-0.5 inline-block h-5 w-px translate-y-1 bg-[#b29bff]" /> : null}
            </p>
            <div className="mt-1 flex items-center justify-between">
              <Paperclip className="size-5 text-[#9a94ad]" />
              <span className="flex size-9 items-center justify-center rounded-full bg-violet text-white">
                <ArrowUp className="size-4" strokeWidth={2.5} />
              </span>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-sm text-white/60">
        Exemplo ilustrativo da tela de conversa. As respostas reais variam conforme o pedido.
      </figcaption>
    </figure>
  );
}
