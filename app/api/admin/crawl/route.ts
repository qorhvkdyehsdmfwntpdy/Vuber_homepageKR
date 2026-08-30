import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
};

const REQUEST_DELAY_MS = 700;
const FETCH_TIMEOUT_MS = 10_000;

function waitForRateLimit() {
  return new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
}

type CrawlResult = {
  name: string;
  platform: 'chzzk' | 'soop';
  namuVerified: boolean;
  chzzkId: string | null;
  soopId: string | null;
  youtubeUrl: string | null;
  cafeUrl: string | null;
  profileImageUrl: string | null;
  youtubeChannelId: string | null;
};

function normalizeUrl(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().replaceAll('\\u0026', '&');
  if (!normalized) return null;
  if (normalized.startsWith('//')) return `https:${normalized}`;
  return normalized;
}

function extractYoutubeHandleFromText(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const patterns = [
    /youtube\.com\/@([a-zA-Z0-9_.-]+)/i,
    /@([a-zA-Z0-9_.-]+)/,
    /\/@([a-zA-Z0-9_.-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return `@${match[1]}`;
  }

  return null;
}

function extractYoutubeChannelIdFromText(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const patterns = [
    /youtube\.com\/channel\/([A-Za-z0-9_-]+)/i,
    /(UC[A-Za-z0-9_-]{22})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

function extractYoutubeHandleFromUrl(url: string | null): string | null {
  return extractYoutubeHandleFromText(url);
}

function extractYoutubeChannelIdFromUrl(url: string | null): string | null {
  return extractYoutubeChannelIdFromText(url);
}

function directYouTubeProfileFromHtml(html: string, targetUrl: string) {
  const imagePatterns = [
    /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
    /<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i,
    /"avatar"[\s\S]{0,500}?"url":"(https?:\\?\/\\?\/[^\"]+)"/i,
    /"channelThumbnailSupportedRenderers"[\s\S]{0,500}?"url":"(https?:\\?\/\\?\/[^\"]+)"/i,
  ];

  let image: string | null = null;
  for (const pattern of imagePatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      image = applyYouTubeHighQuality(normalizeUrl(match[1].replaceAll('\\u0026', '&')));
      if (image) break;
    }
  }

  const channelIdMatch = html.match(/"channelId":"([A-Za-z0-9_-]+)"/i) || html.match(/"externalId":"([A-Za-z0-9_-]+)"/i);
  const channelId = channelIdMatch?.[1] || extractYoutubeChannelIdFromUrl(targetUrl) || null;
  const finalImage = image ? applyYouTubeHighQuality(image) : null;

  if (finalImage) {
    console.log('[CRAWL SUCCESS] Extract Profile for @handle:', finalImage);
  }

  return {
    url: targetUrl,
    image: finalImage,
    channelId,
  };
}

function getYouTubeApiKey() {
  const key = process.env.YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
  console.log('[YT][debug] API key present:', Boolean(key), 'source:', process.env.YOUTUBE_API_KEY ? 'YOUTUBE_API_KEY' : process.env.NEXT_PUBLIC_YOUTUBE_API_KEY ? 'NEXT_PUBLIC_YOUTUBE_API_KEY' : 'none');
  return key || null;
}

function isLikelyChannelAvatarUrl(url: string | null) {
  if (!url) return false;
  const normalized = normalizeUrl(url);
  if (!normalized) return false;
  return /(ytimg\.com|googleusercontent\.com|i\.ytimg\.com)/i.test(normalized) && !/\/vi\/|\/hqdefault|\/default\.jpg|\/sddefault|\/maxresdefault|\/mqdefault|\/0\.jpg/i.test(normalized);
}

function logProfileCandidate(label: string, url: string | null, source: string, extra?: Record<string, unknown>) {
  const normalized = normalizeUrl(url);
  console.log('[YT][profile]', {
    label,
    source,
    raw: url ?? null,
    normalized: normalized ?? null,
    likelyChannelAvatar: isLikelyChannelAvatarUrl(normalized),
    ...extra,
  });
  return normalized;
}

function applyYouTubeHighQuality(url: string | null): string | null {
  const normalized = normalizeUrl(url);
  if (!normalized) return null;
  if (/yt_1200\.png/i.test(normalized)) return null;
  if (!/(ytimg\.com|googleusercontent\.com|i\.ytimg\.com)/i.test(normalized)) {
    return normalized;
  }

  const cleaned = normalized.replace(/=s\d+[^&]*(&|$)/i, '$1');
  const imageUrl = cleaned.endsWith('&') ? cleaned.slice(0, -1) : cleaned;
  const separator = imageUrl.includes('?') ? '&' : '?';
  return `${imageUrl}${separator}s=800-c-k-c0x00ffffff-no-rj`;
}

async function readHtml(url: string) {
  await waitForRateLimit();
  const response = await fetch(url, {
    headers: HEADERS,
    cache: 'no-store',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (response.status === 429 || response.status >= 500) return null;
  if (!response.ok) return null;
  return response.text();
}

async function checkNamuWiki(name: string) {
  try {
    const html = await readHtml(`https://namu.wiki/w/${encodeURIComponent(name)}`);
    if (!html) return false;
    const $ = cheerio.load(html);
    const text = $.text();
    return ['버추얼', '버튜버', '인터넷 방송인', '스트리머'].some((keyword) => text.includes(keyword));
  } catch {
    return false;
  }
}

function getBestThumbnailUrl(thumbnails: unknown): string | null {
  if (!Array.isArray(thumbnails)) return null;
  const best = [...thumbnails]
    .filter((item): item is { url?: string; width?: number } => !!item && typeof item === 'object' && 'url' in item)
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
  return best?.url?.replaceAll('\\u0026', '&') || null;
}

function findYoutubeChannelFromObject(value: unknown): { channelId: string | null; url: string | null; image: string | null } | null {
  if (!value || typeof value !== 'object') return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = findYoutubeChannelFromObject(item);
      if (result) return result;
    }
    return null;
  }

  const record = value as Record<string, unknown>;

  const channelRenderer =
    (record.channelRenderer as Record<string, unknown> | undefined) ??
    (record.channel as Record<string, unknown> | undefined) ??
    (record.content as Record<string, unknown> | undefined)?.channelRenderer as Record<string, unknown> | undefined ??
    (record.richItemRenderer as Record<string, unknown> | undefined)?.content as Record<string, unknown> | undefined;

  if (channelRenderer) {
    const channelId =
      typeof channelRenderer.channelId === 'string'
        ? channelRenderer.channelId
        : typeof (channelRenderer as Record<string, unknown>).browseId === 'string'
          ? (channelRenderer as Record<string, unknown>).browseId as string
          : null;

    const urlFromData =
      typeof (channelRenderer as Record<string, unknown>).canonicalBaseUrl === 'string'
        ? (channelRenderer as Record<string, unknown>).canonicalBaseUrl as string
        : typeof (channelRenderer as Record<string, unknown>).navigationEndpoint === 'object'
          ? (channelRenderer as Record<string, unknown>).navigationEndpoint as Record<string, unknown>
          : null;

    const thumbnails =
      Array.isArray((channelRenderer.thumbnail as Record<string, unknown> | undefined)?.thumbnails)
        ? (channelRenderer.thumbnail as Record<string, unknown>).thumbnails
        : Array.isArray((channelRenderer.avatar as Record<string, unknown> | undefined)?.thumbnails)
          ? (channelRenderer.avatar as Record<string, unknown>).thumbnails
          : Array.isArray((channelRenderer as Record<string, unknown>).thumbnails)
            ? (channelRenderer as Record<string, unknown>).thumbnails as unknown[]
            : null;

    const image = applyYouTubeHighQuality(getBestThumbnailUrl(thumbnails ?? []));
    const channelUrl =
      typeof urlFromData === 'string'
        ? (urlFromData.startsWith('/') ? `https://www.youtube.com${urlFromData}` : urlFromData)
        : channelId
          ? `https://www.youtube.com/channel/${channelId}`
          : null;

    if (channelId || channelUrl || image) {
      return {
        channelId,
        url: channelUrl,
        image,
      };
    }
  }

  const avatar = (record.avatar ?? record.channelAvatar) as Record<string, unknown> | undefined;
  if (avatar && typeof avatar === 'object') {
    const thumbnails = Array.isArray((avatar as Record<string, unknown>).thumbnails)
      ? (avatar as Record<string, unknown>).thumbnails
      : Array.isArray((record.thumbnail as Record<string, unknown> | undefined)?.thumbnails)
        ? (record.thumbnail as Record<string, unknown>).thumbnails
        : null;
    const channelId =
      typeof record.channelId === 'string'
        ? record.channelId
        : typeof record.browseId === 'string'
          ? record.browseId
          : null;
    const image = applyYouTubeHighQuality(getBestThumbnailUrl(thumbnails ?? []));
    if (channelId || image) {
      return {
        channelId,
        url: channelId ? `https://www.youtube.com/channel/${channelId}` : null,
        image,
      };
    }
  }

  for (const item of Object.values(record)) {
    const result = findYoutubeChannelFromObject(item);
    if (result) return result;
  }

  return null;
}

function extractYoutubeMetadataFromHtml(html: string) {
  const candidates = [
    /ytInitialData\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/i,
    /window\["ytInitialData"\]\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/i,
    /"ytInitialData"\s*:\s*(\{[\s\S]*?\})\s*,\s*"/i,
  ];

  for (const pattern of candidates) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;

    try {
      const data = JSON.parse(match[1]);
      const result = findYoutubeChannelFromObject(data);
      if (result && (result.channelId || result.url || result.image)) return result;
    } catch {
      // ignore parse failures and continue to the next fallback
    }
  }

  return { channelId: null, url: null, image: null };
}

async function findYouTubeHandleProfile(handle: string) {
  const cleanedHandle = handle.trim().replace(/^@+/, '');
  if (!cleanedHandle) return { url: null, image: null, channelId: null };

  const handleTag = handle.trim().startsWith('@') ? handle.trim() : `@${cleanedHandle}`;
  const apiKey = getYouTubeApiKey();

  try {
    if (apiKey) {
      const apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${encodeURIComponent(handleTag)}&key=${encodeURIComponent(apiKey)}`;
      console.log('[YT][debug] running channels?forHandle API for:', handleTag, 'url:', apiUrl);
      const response = await fetch(apiUrl, { cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (response.ok) {
        const data = await response.json();
        const item = data?.items?.[0];
        const apiImage = item?.snippet?.thumbnails?.high?.url || item?.snippet?.thumbnails?.medium?.url || item?.snippet?.thumbnails?.default?.url || null;
        const channelId = item?.id || null;
        const finalImage = applyYouTubeHighQuality(apiImage);
        if (finalImage) {
          console.log('[CRAWL SUCCESS] Extract Profile for @handle:', finalImage);
        }
        return {
          url: `https://www.youtube.com/${handleTag}`,
          image: finalImage,
          channelId,
        };
      }
      console.log('[YT][debug] channels?forHandle API failed:', response.status, response.statusText);
    } else {
      console.log('[YT][debug] HTML fallback used because no YouTube API key is configured. Checked keys:', Boolean(process.env.YOUTUBE_API_KEY), Boolean(process.env.NEXT_PUBLIC_YOUTUBE_API_KEY));
    }

    const targetUrl = `https://www.youtube.com/${handleTag}`;
    const html = await readHtml(targetUrl);
    if (!html) {
      console.log('[YT][debug] handle HTML fetch failed for:', targetUrl);
      return { url: targetUrl, image: null, channelId: null };
    }

    const parsed = directYouTubeProfileFromHtml(html, targetUrl);
    return parsed;
  } catch (error) {
    console.log('[YT][debug] handle extraction error:', error instanceof Error ? error.message : error);
    return { url: null, image: null, channelId: null };
  }
}

async function findYoutubeUrl(name: string) {
  try {
    const html = await readHtml(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} 버튜버`)}`);
    if (!html) return null;
    return extractYoutubeMetadataFromHtml(html).url;
  } catch {
    return null;
  }
}

async function findYoutubeProfile(name: string) {
  try {
    const trimmedName = name.trim();

    const directHandleFromText = extractYoutubeHandleFromText(trimmedName);
    if (directHandleFromText) {
      console.log('[YT][debug] direct handle detected in input:', directHandleFromText, 'source:', trimmedName);
      return findYouTubeHandleProfile(directHandleFromText);
    }

    const directChannelIdFromText = extractYoutubeChannelIdFromText(trimmedName);
    if (directChannelIdFromText) {
      const targetUrl = `https://www.youtube.com/channel/${directChannelIdFromText}`;
      console.log('[YT][debug] direct channel id detected in input:', directChannelIdFromText, 'source:', trimmedName);
      const html = await readHtml(targetUrl);
      if (!html) return { url: targetUrl, image: null, channelId: directChannelIdFromText };
      return directYouTubeProfileFromHtml(html, targetUrl);
    }

    if (/^https?:\/\//i.test(trimmedName)) {
      const handle = extractYoutubeHandleFromUrl(trimmedName);
      if (handle) {
        console.log('[YT][debug] direct URL handle detected:', handle, 'source:', trimmedName);
        return findYouTubeHandleProfile(handle);
      }

      const channelId = extractYoutubeChannelIdFromUrl(trimmedName);
      if (channelId) {
        const targetUrl = `https://www.youtube.com/channel/${channelId}`;
        const html = await readHtml(targetUrl);
        if (!html) return { url: targetUrl, image: null, channelId };
        const parsed = directYouTubeProfileFromHtml(html, targetUrl);
        return parsed;
      }
    }

    if (/^@?[A-Za-z0-9._-]+$/.test(trimmedName) && trimmedName.startsWith('@')) {
      console.log('[YT][debug] handle-based lookup detected:', trimmedName);
      return findYouTubeHandleProfile(trimmedName);
    }

    const apiKey = getYouTubeApiKey();
    if (apiKey) {
      const requestUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(`${trimmedName} 버튜버`)}&key=${encodeURIComponent(apiKey)}`;
      console.log('[YT][debug] using YouTube search API for name:', trimmedName, 'url:', requestUrl);
      const response = await fetch(requestUrl, { cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (response.ok) {
        const data = await response.json();
        const channel = data?.items?.[0];
        const channelId = channel?.id?.channelId;
        const image = channel?.snippet?.thumbnails?.high?.url || channel?.snippet?.thumbnails?.medium?.url || channel?.snippet?.thumbnails?.default?.url || null;
        const finalImage = applyYouTubeHighQuality(image);
        logProfileCandidate('name-api', finalImage, 'youtube-v3-search', { query: `${trimmedName} 버튜버`, channelId });
        return { url: channelId ? `https://www.youtube.com/channel/${channelId}` : null, image: finalImage, channelId: channelId || null };
      }
      console.log('[YT][debug] search API failed:', response.status, response.statusText);
    } else {
      console.log('[YT][debug] no API key configured for search-based channel lookup; falling back to HTML search page.');
    }

    const html = await readHtml(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${trimmedName} 버튜버`)}`);
    if (!html) {
      console.log('[YT][debug] HTML search result fetch failed for:', trimmedName);
      return { url: null, image: null, channelId: null };
    }

    const metadata = extractYoutubeMetadataFromHtml(html);
    const finalImage = logProfileCandidate('name-html', metadata.image, 'youtube-search-html', { name: trimmedName, channelId: metadata.channelId });
    return {
      url: metadata.url,
      image: finalImage,
      channelId: metadata.channelId,
    };
  } catch (error) {
    console.log('[YT][debug] name extraction error:', error instanceof Error ? error.message : error);
    return { url: null, image: null, channelId: null };
  }
}

function normalizeCafeUrl(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed, 'https://search.naver.com');
    if (url.hostname !== 'cafe.naver.com') return null;
    if (!url.pathname || url.pathname === '/' || url.pathname.includes('/search') || url.pathname.includes('/Section')) return null;
    const search = url.searchParams.get('query') || '';
    if (search.toLowerCase().includes('search')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function findCafeUrl(name: string) {
  try {
    const html = await readHtml(`https://search.naver.com/search.naver?query=${encodeURIComponent(`${name} 공식 팬카페`)}`);
    if (!html) return null;
    const $ = cheerio.load(html);
    let result: string | null = null;

    $('a[href]').each((_, element) => {
      if (result) return;
      const href = $(element).attr('href');
      if (!href) return;
      const normalized = normalizeCafeUrl(href);
      if (normalized) result = normalized;
    });

    return result;
  } catch {
    return null;
  }
}

async function findChzzkId(name: string) {
  try {
    await waitForRateLimit();
    const response = await fetch(`https://api.chzzk.naver.com/service/v1/search/channels?keyword=${encodeURIComponent(name)}&offset=0&size=1`, { headers: HEADERS, cache: 'no-store' });
    if (response.status === 429 || !response.ok) return null;
    const data = await response.json();
    return data?.content?.data?.[0]?.channel?.channelId || null;
  } catch {
    return null;
  }
}

async function findChzzkProfileImage(channelId: string | null) {
  if (!channelId) return null;
  try {
    const response = await fetch(`https://api.chzzk.naver.com/service/v1/channels/${encodeURIComponent(channelId)}`, { headers: HEADERS, cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    const data = await response.json();
    return data?.content?.channelImageUrl || null;
  } catch {
    return null;
  }
}

async function findSoopId(name: string) {
  try {
    await waitForRateLimit();
    const response = await fetch(`https://sch.sooplive.co.kr/api.php?m=search&service=v2&v=2.0&sz=5&category=user&q=${encodeURIComponent(name)}`, { headers: { ...HEADERS, Referer: 'https://www.sooplive.co.kr/' }, cache: 'no-store' });
    if (response.status === 429 || !response.ok) return null;
    const data = await response.json();
    const users = data?.data?.user || data?.REAL_BJ || [];
    return users[0]?.user_id || users[0]?.user_id_search || null;
  } catch {
    return null;
  }
}

async function findSoopProfileImage(name: string) {
  try {
    await waitForRateLimit();
    const response = await fetch(`https://sch.sooplive.co.kr/api.php?m=search&service=v2&v=2.0&sz=5&category=user&q=${encodeURIComponent(name)}`, { headers: { ...HEADERS, Referer: 'https://www.sooplive.co.kr/' }, cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    const data = await response.json();
    const user = (data?.data?.user || data?.REAL_BJ || [])[0];
    return user?.profile_image || user?.profile_img || user?.user_profile_image || null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('keyword')?.trim();
  const platform = searchParams.get('platform') === 'soop' ? 'soop' : 'chzzk';

  if (!name) return NextResponse.json({ error: '버튜버 이름을 입력해 주세요.' }, { status: 400 });

  const namuVerified = await checkNamuWiki(name);
  const chzzkId = await findChzzkId(name);
  const soopId = await findSoopId(name);
  const youtubeProfile = await findYoutubeProfile(name);
  const youtubeUrl = youtubeProfile.url || await findYoutubeUrl(name);
  const platformImage = platform === 'chzzk' ? await findChzzkProfileImage(chzzkId) : await findSoopProfileImage(name);
  const cafeUrl = await findCafeUrl(name);

  const result: CrawlResult = {
    name,
    platform,
    namuVerified,
    chzzkId,
    soopId,
    youtubeUrl: normalizeUrl(youtubeUrl),
    cafeUrl: normalizeUrl(cafeUrl),
    profileImageUrl: applyYouTubeHighQuality(normalizeUrl(youtubeProfile.image || platformImage)),
    youtubeChannelId: youtubeProfile.channelId,
  };
  return NextResponse.json(result);
}
