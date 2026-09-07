import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/session';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001/api';

/**
 * Proxy genérico client → backend para os módulos de CRM (customers,
 * contacts, opportunities, quotes, orders, activities).
 *
 * Existe porque o JWT fica num cookie httpOnly (nunca chega ao JS do
 * browser — spec §17), então componentes client-side não conseguem montar
 * o header Authorization sozinhos. Este route handler injeta o token
 * server-side e repassa a resposta do backend como está.
 *
 * Não duplica lógica de negócio nem validação — é só um túnel autenticado.
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
  const hasBody = !['GET', 'HEAD', 'DELETE'].includes(req.method) ? true : false;

  const res = await fetch(`${BACKEND_URL}/${path}${search}`, {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: hasBody ? await req.text() : undefined,
    cache: 'no-store',
  });

  const contentType = res.headers.get('content-type') ?? '';

  // Fase 6 — download de PDF de proposta (GET /quotes/:id/pdf) responde
  // binário, não JSON. `res.json()`/`res.text()` corromperiam o arquivo, então
  // este caso repassa os bytes crus com os headers originais em vez de passar
  // pelo `NextResponse.json()` usado para o resto do proxy.
  if (contentType.includes('application/pdf')) {
    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      status: res.status,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': res.headers.get('content-disposition') ?? 'inline',
      },
    });
  }

  const body = contentType.includes('application/json')
    ? await res.json()
    : await res.text();

  return NextResponse.json(body, { status: res.status });
}

export {
  forward as GET,
  forward as POST,
  forward as PATCH,
  forward as DELETE,
};
