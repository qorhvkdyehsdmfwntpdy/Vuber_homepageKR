import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
const SOURCE_URL = 'https://namu.wiki/w/%EB%B2%84%EC%B6%94%EC%96%BC%20%EC%9C%A0%ED%8A%9C%EB%B2%84/%EB%AA%A9%EB%A1%9D/%ED%95%9C%EA%B5%AD';
const HEADERS = { 'User-Agent': 'VTuber-Hub-Collector/1.0', 'Accept-Language': 'ko-KR,ko;q=0.9' };
const EXCLUDED_WORDS = ['나무위키', '토론', '편집', '역사', '버추얼 유튜버', '분류', '목록', '한국', '활동 중', '활동 중단', '활동 종료', '둘러보기', '프로필', '문서', '하위', '상위', '주의사항', '개요', '특징', '기타'];

function collectNames(html: string) {
  const $ = cheerio.load(html);
  const names = new Set<string>();
  $('a[href^="/w/"]').each((_, element) => {
    const name = $(element).text().replace(/\s+/g, ' ').trim();
    if (name.length >= 2 && name.length <= 40 && !EXCLUDED_WORDS.some((word) => name.includes(word))) names.add(name);
  });
  return [...names];
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let supabase;
  try { supabase = createSupabaseAdmin(); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '서버 DB 설정이 없습니다.' }, { status: 503 }); }

  try {
    const response = await fetch(SOURCE_URL, { headers: HEADERS, cache: 'no-store', signal: AbortSignal.timeout(20_000) });
    if (!response.ok) return NextResponse.json({ error: `수집 원본 응답 오류: ${response.status}` }, { status: 502 });
    const names = collectNames(await response.text());
    if (names.length === 0) return NextResponse.json({ discovered: 0, inserted: 0, message: '검증 가능한 후보가 없습니다.' });

    const { data, error } = await supabase.from('vtubers').upsert(names.map((name) => ({ name })), { onConflict: 'name', ignoreDuplicates: true }).select('id,name');
    if (error) return NextResponse.json({ error: error.message, discovered: names.length }, { status: 500 });
    return NextResponse.json({ discovered: names.length, inserted: data?.length || 0, source: SOURCE_URL, updatedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '자동 수집에 실패했습니다.' }, { status: 502 });
  }
}