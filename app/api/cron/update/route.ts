import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

const HEADERS = { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ko-KR,ko;q=0.9' };
type VtuberRow = { id: string; name: string; chzzk_channel_id?: string | null; soop_channel_id?: string | null; youtube_url?: string | null; youtube_channel_id?: string | null };

async function getLive(row: VtuberRow) {
  if (!row.chzzk_channel_id) return false;
  try {
    const response = await fetch(`https://api.chzzk.naver.com/service/v1/channels/${encodeURIComponent(row.chzzk_channel_id)}/live-detail`, { headers: HEADERS, cache: 'no-store', signal: AbortSignal.timeout(8_000) });
    const data = await response.json();
    return response.ok && data?.content?.status === 'OPEN';
  } catch {
    return false;
  }
}

async function getLatestVideo(row: VtuberRow) {
  const source = row.youtube_url || (row.youtube_channel_id ? `https://www.youtube.com/channel/${row.youtube_channel_id}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${row.name} 버튜버`)}`);
  try {
    const response = await fetch(source, { headers: HEADERS, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    const $ = cheerio.load(await response.text());
    const video = $('a[href*="/watch?v="]').first();
    const title = video.attr('title') || video.text().trim();
    return title || null;
  } catch {
    return null;
  }
}

async function getProfileImage(row: VtuberRow) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (apiKey && row.youtube_channel_id) {
      const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${encodeURIComponent(row.youtube_channel_id)}&key=${encodeURIComponent(apiKey)}`, { cache: 'no-store', signal: AbortSignal.timeout(8_000) });
      const data = await response.json();
      const image = data?.items?.[0]?.snippet?.thumbnails?.high?.url || data?.items?.[0]?.snippet?.thumbnails?.default?.url;
      if (image) return image;
    }
    const response = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${row.name} 버튜버`)}`, { headers: HEADERS, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (response.ok) {
      const html = await response.text();
      const image = html.match(/"channelThumbnailSupportedRenderers"[\s\S]{0,1000}?"url":"(https?:\/\/[^" ]+)"/)?.[1];
      if (image) return image.replaceAll('\\u0026', '&');
    }
    if (row.chzzk_channel_id) {
      const response = await fetch(`https://api.chzzk.naver.com/service/v1/channels/${encodeURIComponent(row.chzzk_channel_id)}`, { headers: HEADERS, cache: 'no-store', signal: AbortSignal.timeout(8_000) });
      const data = await response.json();
      return data?.content?.channelImageUrl || null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let supabase;
  try { supabase = createSupabaseAdmin(); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '서버 DB 설정이 없습니다.' }, { status: 503 }); }
  const { data: rows, error } = await supabase.from('vtubers').select('id,name,chzzk_channel_id,soop_channel_id,youtube_url,youtube_channel_id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = [];
  for (const row of (rows || []) as VtuberRow[]) {
    const [isLive, latestVideoTitle, profileImageUrl] = await Promise.all([getLive(row), getLatestVideo(row), getProfileImage(row)]);
    const update = { live_status: isLive, latest_video_title: latestVideoTitle, ...(profileImageUrl ? { profile_image_url: profileImageUrl } : {}) };
    const { error: updateError } = await supabase.from('vtubers').update(update).eq('id', row.id);
    results.push({ id: row.id, name: row.name, isLive, latestVideoTitle, profileImageUrl, updated: !updateError, error: updateError?.message });
  }
  return NextResponse.json({ updatedAt: new Date().toISOString(), count: results.length, results });
}