"use client";

/** Último recurso: erro no próprio layout raiz. Sem dependências, para não falhar de novo. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: "3rem 1.25rem", background: "#fbfafd", color: "#15131c" }}>
        <main style={{ maxWidth: "32rem", margin: "0 auto" }}>
          <h1 style={{ fontSize: "1.75rem" }}>O VIVA encontrou um erro inesperado</h1>
          <p style={{ fontSize: "1.0625rem", lineHeight: 1.6, color: "#474357" }}>
            Seus dados continuam salvos. Recarregue a página para tentar de novo.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ minHeight: 44, padding: "0 1rem", borderRadius: 12, border: 0, background: "#6d3bf5", color: "#fff", fontSize: "1rem", fontWeight: 500, cursor: "pointer" }}
          >
            Tentar de novo
          </button>
        </main>
      </body>
    </html>
  );
}
