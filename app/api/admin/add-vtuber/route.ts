import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9',
};

type CrawlItem = {
  name: string;
  platform?: 'chzzk' | 'soop';
  chzzkId?: string | null;
  soopId?: string | null;
  youtubeUrl?: string | null;
  cafeUrl?: string | null;
  profileImageUrl?: string | null;
  youtubeChannelId?: string | null;
};

// ----------------------------------------------------
// Step 1: 나무위키 (존재 여부 및 버튜버 키워드 확인)
// ----------------------------------------------------
async function checkNamuWiki(name: string): Promise<boolean> {
  try {
    const res = await fetch(`https://namu.wiki/w/${encodeURIComponent(name)}`, { headers: HEADERS });
    if (res.status === 200) {
      const html = await res.text();
      // 나무위키 문서 내 버추얼/버튜버/방송 관련 단어가 포함되어 있는지 확인
      return html.includes('버추얼') || html.includes('인터넷 방송인') || html.includes('유튜버') || html.includes('스트리머');
    }
    return false;
  } catch {
    return false;
  }
}

// ----------------------------------------------------
// Step 2: 유튜브 (공식 채널 URL 탐색)
// ----------------------------------------------------
async function findYoutubeUrl(name: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(name + ' 버튜버')}`, { headers: HEADERS });
    const html = await res.text();
    const match = html.match(/"canonicalBaseUrl":"(\/@[\w.-]+)"/);
    return match ? `https://www.youtube.com${match[1]}` : null;
  } catch {
    return null;
  }
}

// ----------------------------------------------------
// Step 3-A: 치지직 (채널 ID 탐색)
// ----------------------------------------------------
async function findChzzkChannel(name: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.chzzk.naver.com/service/v1/search/channels?keyword=${encodeURIComponent(name)}&offset=0&size=1`,
      { headers: HEADERS }
    );
    const json = await res.json();
    return json.content?.data?.[0]?.channel?.channelId || null;
  } catch {
    return null;
  }
}

// ----------------------------------------------------
// Step 3-B: SOOP (BJ ID 탐색)
// ----------------------------------------------------
async function findSoopChannel(name: string): Promise<string | null> {
  try {
    const url = `https://sch.sooplive.co.kr/api.php?m=search&service=v2&v=2.0&sz=5&category=user&q=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers: { ...HEADERS, Referer: 'https://www.sooplive.co.kr/' } });
    const json = await res.json();
    const bjList = json?.data?.user || json?.REAL_BJ || [];
    return bjList.length > 0 ? bjList[0].user_id || bjList[0].user_id_search || null : null;
  } catch {
    return null;
  }
}

// ----------------------------------------------------
// Step 4: 네이버 카페 (공식 팬카페 URL 탐색)
// ----------------------------------------------------
function normalizeCafeUrl(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed, 'https://search.naver.com');
    if (url.hostname !== 'cafe.naver.com') return null;
    if (!url.pathname || url.pathname === '/' || url.pathname.includes('/search') || url.pathname.includes('/Section')) return null;
    if (url.searchParams.get('query')?.toLowerCase().includes('search')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function findCafeUrl(name: string): Promise<string | null> {
  try {
    const res = await fetch(`https://search.naver.com/search.naver?query=${encodeURIComponent(name + ' 공식 팬카페')}`, { headers: HEADERS });
    const html = await res.text();
    const $ = cheerio.load(html);
    let cafeUrl: string | null = null;

    $('a[href]').each((_, el) => {
      if (cafeUrl) return;
      const href = $(el).attr('href');
      const normalized = normalizeCafeUrl(href ?? null);
      if (normalized) cafeUrl = normalized;
    });

    return cafeUrl;
  } catch {
    return null;
  }
}

// ----------------------------------------------------
// GET: 순차 크롤링 실행 및 DB 중복 체크
// ----------------------------------------------------
export async function GET(req: Request) {
  let supabase;
  try { supabase = createSupabaseAdmin(); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '관리자 DB 설정이 없습니다.' }, { status: 503 }); }
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('keyword'); // 버튜버 이름
  const platform = (searchParams.get('platform') as 'chzzk' | 'soop') || 'chzzk';

  if (!name) {
    return NextResponse.json({ error: '버튜버 이름을 입력해 주세요.' }, { status: 400 });
  }

  // 0. Supabase 기존 DB 중복 확인
  const { data: existing } = await supabase
    .from('vtubers')
    .select('*')
    .eq('name', name)
    .single();

  if (existing) {
    return NextResponse.json({
      items: [
        {
          name: existing.name,
          platform: existing.chzzk_channel_id ? 'chzzk' : 'soop',
          chzzkId: existing.chzzk_channel_id,
          soopId: existing.soop_channel_id,
          youtubeUrl: existing.youtube_url,
          cafeUrl: existing.cafe_url,
          profileImageUrl: existing.profile_image_url,
          youtubeChannelId: existing.youtube_channel_id,
          isAlreadyInDb: true,
          namuVerified: true,
        },
      ],
      summary: { total: 1, newCount: 0, existingCount: 1 },
    });
  }

  // 순서대로 크롤링 진행
  // 1. 나무위키 검증
  const namuVerified = await checkNamuWiki(name);

  // 2. 유튜브 URL
  const youtubeUrl = await findYoutubeUrl(name);

  // 3. 치지직 OR SOOP ID
  const chzzkId = platform === 'chzzk' ? await findChzzkChannel(name) : null;
  const soopId = platform === 'soop' ? await findSoopChannel(name) : null;

  // 4. 네이버 카페 URL
  const cafeUrl = await findCafeUrl(name);

  const resultItem = {
    name,
    platform,
    chzzkId,
    soopId,
    youtubeUrl,
    cafeUrl,
    isAlreadyInDb: false,
    namuVerified, // 나무위키 문서 확인 성공 여부
  };

  return NextResponse.json({
    items: [resultItem],
    summary: { total: 1, newCount: 1, existingCount: 0 },
  });
}

// ----------------------------------------------------
// POST: 검수 확인 후 Supabase 최종 저장
// ----------------------------------------------------
export async function POST(req: Request) {
  try {
    const supabase = createSupabaseAdmin();
    const body = await req.json();
    const items = Array.isArray(body?.items) ? (body.items as CrawlItem[]) : [];

    if (!items.length) {
      return NextResponse.json({ error: '저장할 버튜버 정보가 없습니다.' }, { status: 400 });
    }

    const insertData = items
      .map((item) => {
        const safeName = String(item?.name ?? '').trim();
        const safePlatform = item?.platform === 'chzzk' || item?.platform === 'soop' ? item.platform : null;

        if (!safeName || !safePlatform) {
          return null;
        }

        return {
          name: safeName,
          chzzk_channel_id: (item.chzzkId ?? '').toString().trim() || null,
          soop_channel_id: (item.soopId ?? '').toString().trim() || null,
          youtube_url: item.youtubeUrl?.trim() || null,
          cafe_url: item.cafeUrl?.trim() || null,
          profile_image_url: item.profileImageUrl?.trim() || null,
          youtube_channel_id: (item.youtubeChannelId ?? '').toString().trim() || null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (!insertData.length) {
      return NextResponse.json({ error: '유효한 이름과 플랫폼 값이 없어 저장할 수 없습니다.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('vtubers')
      .upsert(insertData, { onConflict: 'name' })
      .select();

    if (error) {
      const message = error.message.includes('Invalid API key') || error.message.includes('JWT')
        ? 'Supabase service role key가 유효하지 않습니다. Supabase 콘솔에서 새 키를 발급한 뒤 .env.local의 SUPABASE_SERVICE_ROLE_KEY를 교체해주세요.'
        : error.message;
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: Array.isArray(data) ? data.length : 0 });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : '저장 실패';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}