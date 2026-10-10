import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Proxy (antigo "middleware"): roda antes de cada página.
 * 1) renova a sessão do usuário quando o token está perto de vencer;
 * 2) faz o redirecionamento rápido de quem não está logado.
 * A proteção de verdade continua no servidor e no banco (RLS).
 */
const PROTECTED_PREFIXES = ["/app", "/admin"];
const AUTH_PAGES = ["/entrar", "/criar-conta", "/recuperar-senha"];

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!url || !key) {
    if (isProtected) {
      return NextResponse.redirect(new URL("/configuracao-pendente", request.url));
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    userId = null;
  }

  if (isProtected && !userId) {
    const target = new URL("/entrar", request.url);
    if (pathname !== "/app") {
      target.searchParams.set("voltar", pathname + request.nextUrl.search);
    }
    return copyCookies(response, NextResponse.redirect(target));
  }

  if (userId && AUTH_PAGES.includes(pathname)) {
    return copyCookies(response, NextResponse.redirect(new URL("/app", request.url)));
  }

  return response;
}

function copyCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  return to;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|robots.txt|sitemap.xml|opengraph-image|api/stripe/webhook|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)",
  ],
};
