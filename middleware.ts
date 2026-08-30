import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_COOKIE = 'vtuber_admin_auth';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 로그인 페이지(/admin/login)이거나 /admin 경로가 아닌 경우 검증을 건너뜁니다.
  if (!pathname.startsWith('/admin') || pathname === '/admin/login') {
    return NextResponse.next();
  }

  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  const isAuthenticated = !!adminPassword && request.cookies.get(ADMIN_COOKIE)?.value === adminPassword;

  if (!isAuthenticated) {
    // 인증 실패 시 메인이 아닌 로그인 페이지로 이동시킵니다.
    const redirectUrl = new URL('/admin/login', request.url);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete(ADMIN_COOKIE);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};