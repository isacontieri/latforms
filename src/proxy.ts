import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Só renova a sessão do Supabase e manda para /login quem não está logado em /admin.
 * NÃO é a checagem de autorização: páginas e rotas chamam `verificarConsultora()`/`exigirConsultora()`.
 * Não intercepta /f/*, /api/f/* nem /api/cron/* (autenticação própria) — ver `config.matcher`.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );

  // Precisa rodar antes de qualquer resposta para a renovação do token ser gravada nos cookies.
  const { data } = await supabase.auth.getClaims();
  const logado = Boolean(data?.claims);
  const { pathname } = request.nextUrl;

  if (!logado && pathname.startsWith('/admin')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  // Não redirecionar /login → /admin só porque há sessão: o getClaims confia no JWT, que continua válido por
  // até 1 h depois de a conta ser removida; o /admin (getUser) mandaria de volta ao /login → loop.

  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/login', '/api/((?!f/|cron/).*)'],
};
