import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
};

function summarize(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const rules: [RegExp, string][] = [
    [/휴방|방송 쉽니다|방송을 쉬/, '오늘 휴방 공지가 있습니다.'],
    [/콜라보|합방|게스트/, '콜라보 방송 일정 공지가 있습니다.'],
    [/방송 일정|방송 시간|방송 공지/, '방송 일정 공지가 있습니다.'],
    [/콘서트|공연|라이브 일정/, '공연 또는 라이브 일정 공지가 있습니다.'],
  ];
  const matched = rules.find(([pattern]) => pattern.test(normalized));
  return matched ? matched[1] : normalized ? `${normalized.slice(0, 90)}${normalized.length > 90 ? '...' : ''}` : '새로운 공지 정보가 없습니다.';
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name')?.trim();
  const cafeUrl = searchParams.get('cafeUrl');
  if (!name) return NextResponse.json({ error: '버튜버 이름이 필요합니다.' }, { status: 400 });
  if (!cafeUrl) return NextResponse.json({ summary: '등록된 네이버 카페가 없습니다.' });

  try {
    const response = await fetch(cafeUrl, { headers: HEADERS, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return NextResponse.json({ summary: '카페 공지를 불러오지 못했습니다.' });
    const $ = cheerio.load(await response.text());
    $('script, style, noscript, nav, header, footer').remove();
    const candidates = [
      $('article').first().text(),
      $('[class*="article"]:first').text(),
      $('[class*="content"]:first').text(),
      $('body').text(),
    ];
    return NextResponse.json({ summary: summarize(candidates.find((text) => text.trim()) || ''), source: cafeUrl });
  } catch {
    return NextResponse.json({ summary: '카페 공지를 불러오지 못했습니다.' });
  }
}