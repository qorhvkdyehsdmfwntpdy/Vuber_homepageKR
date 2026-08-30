import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

type Video = { title: string; url: string; publishedAt: string | null };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelUrl = searchParams.get('channelUrl');
  const name = searchParams.get('name');
  if (!channelUrl && !name) return NextResponse.json({ video: null });

  try {
    const source = channelUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} 버튜버`)}`;
    const response = await fetch(source, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ko-KR,ko;q=0.9' },
      cache: 'no-store',
    });
    if (!response.ok) return NextResponse.json({ video: null });
    const html = await response.text();
    const $ = cheerio.load(html);
    const firstVideo = $('a[href*="/watch?v="]').first();
    const href = firstVideo.attr('href');
    const title = firstVideo.attr('title') || firstVideo.find('yt-formatted-string').text().trim() || firstVideo.text().trim();
    return NextResponse.json({ video: href && title ? { title, url: `https://www.youtube.com${href.split('&')[0]}`, publishedAt: null } satisfies Video : null });
  } catch {
    return NextResponse.json({ video: null });
  }
}
