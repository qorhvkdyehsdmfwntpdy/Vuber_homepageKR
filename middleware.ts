import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_COOKIE = 'vtuber_admin_auth';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  const isAuthenticated = !!adminPassword && request.cookies.get(ADMIN_COOKIE)?.value === adminPassword;

  if (!isAuthenticated) {
    const redirectUrl = new URL('/', request.url);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete(ADMIN_COOKIE);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
