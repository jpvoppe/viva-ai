"use client";

import { isValidElement, useState, type ComponentProps, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy } from "lucide-react";

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

export function useCopy(): [boolean, (text: string) => Promise<boolean>] {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      return true;
    } catch {
      return false;
    }
  };
  return [copied, copy];
}

function CodeBlock({ children }: ComponentProps<"pre">) {
  const [copied, copy] = useCopy();
  const code = isValidElement<{ className?: string; children?: ReactNode }>(children) ? children : null;
  const language = /language-([\w-]+)/.exec(code?.props.className ?? "")?.[1];
  return (
    <div className="code-block">
      <div className="flex items-center justify-between bg-[#221e2e] py-1 pl-4 pr-1 text-sm text-[#c3bed2]">
        <span>{language ?? "código"}</span>
        <button
          type="button"
          onClick={() => void copy(textOf(code?.props.children).replace(/\n$/, ""))}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-sm px-2.5 hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
          <span aria-live="polite">{copied ? "Copiado" : "Copiar código"}</span>
        </button>
      </div>
      <pre tabIndex={0}>{children}</pre>
    </div>
  );
}

/**
 * Renderiza a resposta da IA com segurança:
 * - HTML bruto não é interpretado (padrão do react-markdown);
 * - imagens remotas viram link (evita rastreamento e vazamento por URL);
 * - links abrem em nova aba, sem repassar a origem.
 */
export default function Markdown({ content }: { content: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: false, ignoreMissing: true }]]}
        components={{
          pre: CodeBlock,
          table: ({ children }) => (
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabela">
              <table>{children}</table>
            </div>
          ),
          a: ({ href, children }) => {
            const safe = typeof href === "string" && /^(https?:|mailto:)/i.test(href);
            if (!safe) return <span>{children}</span>;
            return (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                {children}
              </a>
            );
          },
          img: ({ src, alt }) => {
            const url = typeof src === "string" && /^https?:/i.test(src) ? src : null;
            return url ? (
              <a href={url} target="_blank" rel="noopener noreferrer nofollow">
                {alt || "Abrir imagem"}
              </a>
            ) : (
              <span>{alt}</span>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
