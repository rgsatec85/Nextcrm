import { NextRequest, NextResponse } from 'next/server';
import { backend, BackendError } from '@/lib/backend';
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/lib/session';

export async function POST(req: NextRequest) {
  const payload = await req.json();

  try {
    const result = await backend.signup(payload);

    const res = NextResponse.json({ user: result.user, company: result.company });
    res.cookies.set(SESSION_COOKIE, result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return res;
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json(err.body, { status: err.status });
    }
    return NextResponse.json({ message: 'Erro inesperado' }, { status: 500 });
  }
}
