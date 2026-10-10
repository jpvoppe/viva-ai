import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { MotionConfig } from "motion/react";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

const display = localFont({
  src: "./fonts/bricolage-grotesque.woff2",
  variable: "--font-display-face",
  display: "swap",
  weight: "200 800",
});

const body = localFont({
  src: [
    { path: "./fonts/instrument-sans.woff2", style: "normal", weight: "400 700" },
    { path: "./fonts/instrument-sans-italic.woff2", style: "italic", weight: "400 700" },
  ],
  variable: "--font-body",
  display: "swap",
});

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "VIVA AI — o assistente inteligente para a vida cotidiana",
    template: "%s · VIVA AI",
  },
  description:
    "VIVA AI ajuda você a estudar, organizar tarefas, criar conteúdo e tirar projetos do papel, em português e no seu ritmo.",
  applicationName: "VIVA AI",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "VIVA AI",
    title: "VIVA AI — o assistente inteligente para a vida cotidiana",
    description:
      "Estude, organize a semana, crie conteúdo e planeje projetos com um assistente que fala a sua língua.",
    url: siteUrl,
  },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfafd" },
    { media: "(prefers-color-scheme: dark)", color: "#15131c" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <a
          href="#conteudo"
          className="sr-only-focusable fixed left-3 top-3 z-[100] rounded-md bg-violet px-4 py-2 font-medium text-white"
        >
          Pular para o conteúdo
        </a>
        <ThemeProvider>
          <MotionConfig reducedMotion="user">
            <TooltipProvider>
              <ToastProvider>{children}</ToastProvider>
            </TooltipProvider>
          </MotionConfig>
        </ThemeProvider>
      </body>
    </html>
  );
}
