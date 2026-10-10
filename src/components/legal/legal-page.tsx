import type { ReactNode } from "react";

/** Moldura das páginas legais: coluna de leitura confortável e títulos consistentes. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
      <h1 className="text-4xl sm:text-5xl" style={{ fontStretch: "86%" }}>
        {title}
      </h1>
      <p className="mt-3 text-ink-muted">Última atualização: {updated}</p>
      <div className="mt-8 flex flex-col gap-8 text-[1.0625rem] leading-relaxed text-ink-soft [&_a]:font-medium [&_a]:text-violet-text [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:text-ink [&_li]:mt-1.5 [&_p+p]:mt-3 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </article>
  );
}

export function Pending({ children }: { children: ReactNode }) {
  return <span className="rounded bg-warning-bg px-1.5 py-0.5 text-warning">{children}</span>;
}
