import { NextResponse } from 'next/server';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
};

function decodeUrl(value: string) {
  return value.replaceAll('\\u0026', '&').replaceAll('\\/', '/');
}

function findImage(html: string) {
  const patterns = [
    /"channelMetadataRenderer"[\s\S]{0,5000}?"avatar"[\s\S]{0,1000}?"url":"(https?:[^" ]+)"/,
    /"avatar"[\s\S]{0,500}?"thumbnails"[\s\S]{0,500}?"url":"(https?:[^" ]+)"/,
  ];
  for (const pattern of patterns) {
    const image = html.match(pattern)?.[1];
    if (image) return decodeUrl(image);
  }
  return null;
}

async function findYoutubeApiImage(name: string | null, youtubeUrl: string | null) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  try {
    const channelId = youtubeUrl?.match(/youtube\.com\/channel\/([^/?]+)/)?.[1];
    const endpoint = channelId
      ? `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${encodeURIComponent(channelId)}&key=${encodeURIComponent(apiKey)}`
      : `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(`${name || ''} 버튜버`)}&key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(endpoint, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    const data = await response.json();
    const snippet = data?.items?.[0]?.snippet;
    return snippet?.thumbnails?.high?.url || snippet?.thumbnails?.default?.url || null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name')?.trim();
  const youtubeUrl = searchParams.get('youtubeUrl')?.trim();
  const source = youtubeUrl || (name ? `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} 버튜버`)}` : null);
  if (!source) return NextResponse.json({ image: null });

  try {
    const apiImage = await findYoutubeApiImage(name || null, youtubeUrl || null);
    if (apiImage) return NextResponse.json({ image: apiImage, source: 'youtube-api' });
    const response = await fetch(source, { headers: HEADERS, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return NextResponse.json({ image: null });
    return NextResponse.json({ image: findImage(await response.text()) });
  } catch {
    return NextResponse.json({ image: null });
  }
}