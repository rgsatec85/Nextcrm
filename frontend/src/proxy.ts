import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';

// Só checa a PRESENÇA do cookie (redireciona para /login se ausente). A
// validação de assinatura/expiração do JWT acontece a cada chamada real ao
// backend (server components/route handlers) — este proxy (ex-"middleware")
// não deve reimplementar verificação de JWT nem tomar decisões de
// autorização por tenant.
export function proxy(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('from', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/portal/:path*'],
};
