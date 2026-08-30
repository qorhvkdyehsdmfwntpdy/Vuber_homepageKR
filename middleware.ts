import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_COOKIE = 'vtuber_admin_auth';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. 로그인 페이지(/admin/login) 접근은 허용
  if (pathname === '/admin/login') {
    return NextResponse.next();
  }

  // 2. /admin 하위 경로 접근 시 쿠키 검증
  if (pathname.startsWith('/admin')) {
    const adminPassword = process.env.ADMIN_PASSWORD?.trim();
    const authCookie = request.cookies.get(ADMIN_COOKIE)?.value;

    const isAuthenticated = !!adminPassword && authCookie === adminPassword;

    // 인증되지 않은 경우 /admin/login으로 리다이렉트
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};