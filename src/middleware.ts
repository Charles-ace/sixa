import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/account';
import { verifyToken } from '@/lib/auth/token';
import type { SessionPayload } from '@/lib/auth/session';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifyToken<SessionPayload>(token) : null;

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.searchParams.set('signin', '1');
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*'],
};
