import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // /admin 페이지 접속 시 비밀번호 입력 폼이 정상적으로 뜨도록 통과시킵니다.
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};