import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/session';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001/api';

/**
 * Mesmo proxy genérico de app/api/crm/[...path]/route.ts, mas para as rotas
 * do Portal do Cliente (backend prefixo /portal). Existe como um túnel
 * separado — em vez de reusar o proxy de /api/crm — só para manter a URL
 * client-side (`/api/portal/...`) simétrica ao backend (`/portal/...`), sem
 * nenhuma lógica de autorização própria: o hard lock por customerId
 * continua sendo feito inteiramente no backend (PortalService), nunca aqui.
 */
async function forward(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const { path: pathSegments } = await params;
  const path = pathSegments.join('/');
  const search = req.nextUrl.search;
  const hasBody = !['GET', 'HEAD', 'DELETE'].includes(req.method);

  const res = await fetch(`${BACKEND_URL}/portal/${path}${search}`, {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: hasBody ? await req.text() : undefined,
    cache: 'no-store',
  });

  const contentType = res.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json')
    ? await res.json()
    : await res.text();

  return NextResponse.json(body, { status: res.status });
}

export { forward as GET, forward as POST, forward as PATCH, forward as DELETE };
