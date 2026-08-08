import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'sixa_session';

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/app/login' || pathname === '/app/login/') {
    return NextResponse.next();
  }

  if (request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/app/login', request.url);
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/app/:path*'],
};