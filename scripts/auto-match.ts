import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 1. 치지직 채널 자동 검색 함수
async function findChzzkChannel(name: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.chzzk.naver.com/service/v1/search/channels?keyword=${encodeURIComponent(
        name
      )}&offset=0&size=1`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      }
    );
    const json = await res.json();
    const channel = json.content?.data?.[0]?.channel;
    if (channel && channel.channelName.includes(name.split(' ')[0])) {
      return channel.channelId;
    }
  } catch (e) {
    console.error(`[치지직 검색 에러] ${name}:`, e);
  }
  return null;
}

// 2. 유튜브 채널 자동 검색 함수
async function findYoutubeUrl(name: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(name)}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      }
    );
    const html = await res.text();
    // HTML 내에서 첫 번째 채널 핸들(@...) 패턴 파싱
    const match = html.match(/"canonicalBaseUrl":"(\/@[\w.-]+)"/);
    if (match && match[1]) {
      return `https://www.youtube.com${match[1]}`;
    }
  } catch (e) {
    console.error(`[유튜브 검색 에러] ${name}:`, e);
  }
  return null;
}

async function autoMatchAll() {
  console.log('🔍 DB 내 버튜버들의 치지직/유튜브 채널 자동 매칭을 시작합니다...');

  const { data: vtubers, error } = await supabase.from('vtubers').select('*');
  if (error || !vtubers) return;

  for (const vtuber of vtubers) {
    console.log(`\n⏳ [${vtuber.name}] 채널 정보 탐색 중...`);

    const chzzkId = vtuber.chzzk_channel_id || (await findChzzkChannel(vtuber.name));
    const youtubeUrl = vtuber.youtube_url || (await findYoutubeUrl(vtuber.name));

    const updates: Record<string, string> = {};
    if (chzzkId && !vtuber.chzzk_channel_id) updates.chzzk_channel_id = chzzkId;
    if (youtubeUrl && !vtuber.youtube_url) updates.youtube_url = youtubeUrl;

    if (Object.keys(updates).length > 0) {
      await supabase.from('vtubers').update(updates).eq('id', vtuber.id);
      console.log(`✅ [${vtuber.name}] 매칭 성공:`, updates);
    } else {
      console.log(`ℹ️ [${vtuber.name}] 이미 최신 정보이거나 매칭 결과가 없습니다.`);
    }

    // 서버 블락 방지를 위한 차분한 간격 요청 (0.5초)
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log('\n🎉 모든 버튜버 채널 매칭 작업 완료!');
}

autoMatchAll();