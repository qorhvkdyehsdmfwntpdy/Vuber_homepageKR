import { redis } from './redis';
import { LiveStatus } from '../types/vtuber';

// 치지직 방송 상태 무료 수집
export async function fetchChzzkStatus(channelId: string): Promise<LiveStatus | null> {
  try {
    const res = await fetch(`https://api.chzzk.naver.com/polling/v2/channels/${channelId}/live-status`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 300 } // 5분 자동 캐싱
    });
    if (!res.ok) return null;
    
    const data = await res.json();
    const live = data.content;

    return {
      vtuber_id: channelId,
      platform: 'chzzk',
      is_live: live?.status === 'LIVE',
      title: live?.liveTitle || '',
      viewer_count: live?.concurrentUserCount || 0,
      thumbnail_url: live?.liveImageUrl?.replace('{type}', '360') || '',
      updated_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Chzzk Fetch Error:', error);
    return null;
  }
}

// 수집된 데이터를 Upstash Redis에 5분간 캐싱 저장
export async function updateLiveCache(vtuberId: string, status: LiveStatus) {
  // TTL 300초(5분) 설정으로 $0 비용 및 서버 과부하 방지
  await redis.set(`live:${vtuberId}`, JSON.stringify(status), { ex: 300 });
}