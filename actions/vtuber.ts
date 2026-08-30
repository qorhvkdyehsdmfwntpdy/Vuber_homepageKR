'use server';

import { supabase } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import { fetchChzzkStatus, updateLiveCache } from '@/lib/collector';
import { LiveStatus, VTuber } from '@/types/vtuber';

// 등록된 버튜버 목록 불러오기
export async function getVTuberList(): Promise<VTuber[]> {
  const { data, error } = await supabase.from('vtubers').select('*');
  if (error) {
    console.error('Supabase Fetch Error:', JSON.stringify(error, null, 2));
    return [];
  }
  return data || [];
}

// 버튜버 라이브 상태 가져오기 (Redis 캐시 1차 조회 -> 없으면 API 호출)
export async function getVTuberLiveStatus(vtuber: VTuber): Promise<LiveStatus | null> {
  const cacheKey = `live:${vtuber.id}`;
  
  // 1. Upstash Redis 캐시 확인 ($0 최적화)
  const cached = await redis.get<LiveStatus>(cacheKey);
  if (cached) return cached;

  // 2. 치지직 연동 시 실시간 데이터 수집
  if (vtuber.chzzk_channel_id) {
    const status = await fetchChzzkStatus(vtuber.chzzk_channel_id);
    if (status) {
      status.vtuber_id = vtuber.id;
      await updateLiveCache(vtuber.id, status); // 5분간 캐싱
      return status;
    }
  }

  return null;
}