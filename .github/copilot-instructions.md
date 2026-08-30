# 버튜버 대시보드 프로젝트 시스템 규칙

## 1. 프로젝트 아키텍처 맵 (Architecture Map)
- MOD-01: [Type Layer] `types/vtuber.ts`, `lib/supabase.ts`
- MOD-02: [Live Status API] `app/api/live-status/route.ts`
- MOD-03: [Crawling API] `app/api/admin/crawl/route.ts`
- MOD-04: [Admin UI] `app/admin/page.tsx`
- MOD-05: [Main Dashboard] `app/page.tsx`
- MOD-06: [Automation Cron] `app/api/cron/update/route.ts`, `vercel.json`
- MOD-07: [Security/SEO] `middleware.ts`, `public/manifest.json`

## 2. 코드 수정 제약 조건
1. 지시받은 MOD(모듈) 이외의 다른 파일은 절대 수정하지 마세요.
2. 컴포넌트 간 'use client' 지시어 위치 충돌이 나지 않도록 주의하세요.
3. 데이터 패칭 시 null/undefined 방어 로직(옵셔널 체이닝 `?.`, Fallback UI)을 필수로 적용하세요.

## 3. 작업 완료 후 필수 QA (자동 수행)
모든 코드 수정이 끝난 후 아래 3단계를 스스로 점검하고 결과를 요약 보고하세요.
1. 불필요한 import 및 더미 코드 정리
2. 백그라운드 터미널에서 `npm run build` 실행 및 컴파일 에러 수정
3. `localhost:3000` 진입 시 런타임 에러(빈 화면, 렌더링 실패)가 없는지 확인
