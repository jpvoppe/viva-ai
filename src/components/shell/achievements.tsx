"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Award, X } from "lucide-react";
import { syncAchievementsAction } from "@/features/organizer/actions";
import { achievementByCode, type Achievement } from "@/lib/achievements";

type AchievementsApi = {
  /** Pergunta ao servidor se alguma conquista nova foi desbloqueada. */
  check: () => void;
};

const AchievementsContext = createContext<AchievementsApi>({ check: () => {} });

export function useAchievements(): AchievementsApi {
  return useContext(AchievementsContext);
}

/**
 * Celebração curta quando uma conquista REAL é desbloqueada
 * (o servidor confere os eventos registrados; a tela não decide nada).
 */
export function AchievementsProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [queue, setQueue] = useState<Achievement[]>([]);
  const pending = useRef(false);

  const check = useCallback(() => {
    if (!enabled || pending.current) return;
    pending.current = true;
    void syncAchievementsAction()
      .then((result) => {
        if (!result.ok) return;
        const unlocked = result.data.map(achievementByCode).filter((a): a is Achievement => Boolean(a));
        if (unlocked.length) setQueue((current) => [...current, ...unlocked]);
      })
      .finally(() => {
        pending.current = false;
      });
  }, [enabled]);

  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), 5000);
    return () => clearTimeout(timer);
  }, [current]);

  const api = useMemo(() => ({ check }), [check]);

  return (
    <AchievementsContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+4.25rem)] z-[70] flex justify-center px-4 lg:top-6"
        aria-live="polite"
      >
        <AnimatePresence>
          {current ? (
            <motion.div
              key={current.code}
              role="status"
              initial={{ opacity: 0, y: -16, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-lg border border-line bg-raised p-3 pr-2 shadow-3"
            >
              <motion.span
                aria-hidden="true"
                initial={{ rotate: -20, scale: 0.6 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.08 }}
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-white"
              >
                <Award className="size-5" />
              </motion.span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-muted">Conquista desbloqueada</p>
                <p className="truncate font-display font-semibold">{current.title}</p>
                <p className="truncate text-sm text-ink-soft">{current.description}</p>
              </div>
              <button
                type="button"
                aria-label="Fechar aviso de conquista"
                onClick={() => setQueue((q) => q.slice(1))}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-ink-muted hover:bg-sunken hover:text-ink"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </AchievementsContext.Provider>
  );
}
