import { useEffect, useState } from 'react';
import type { LiveStatus } from '@/types/vtuber';

interface VTuberProps {
  vtuber: {
    name: string;
    chzzk_channel_id?: string;
    soop_channel_id?: string;
    youtube_url?: string;
    cafe_url?: string;
    youtube_channel_id?: string;
  };
  status?: LiveStatus | null;
  onStatusChange?: (status: LiveStatus | null) => void;
}

export default function VTuberCard({ vtuber, status, onStatusChange }: VTuberProps) {
  const [latestVideo, setLatestVideo] = useState<{ title: string; url: string } | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'video' | 'notice'>('video');
  const [shouldLoadCardData, setShouldLoadCardData] = useState(false);
  const liveUrl = vtuber.chzzk_channel_id
    ? `https://chzzk.naver.com/live/${vtuber.chzzk_channel_id}`
    : vtuber.soop_channel_id
    ? `https://play.sooplive.co.kr/${vtuber.soop_channel_id}`
    : null;

  useEffect(() => {
    const timer = setTimeout(() => setShouldLoadCardData(true), 200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!shouldLoadCardData || activeTab !== 'video' || latestVideo || videoLoading) return;
    setVideoLoading(true);
    const channelUrl = vtuber.youtube_url || (vtuber.youtube_channel_id ? `https://www.youtube.com/channel/${vtuber.youtube_channel_id}` : '');
    fetch(`/api/youtube?${channelUrl ? `channelUrl=${encodeURIComponent(channelUrl)}` : `name=${encodeURIComponent(vtuber.name)}`}`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((data: { video?: { title: string; url: string } | null }) => setLatestVideo(data.video || null))
      .catch(() => setLatestVideo(null))
      .finally(() => setVideoLoading(false));
  }, [activeTab, latestVideo, shouldLoadCardData, videoLoading, vtuber.name, vtuber.youtube_channel_id, vtuber.youtube_url]);

  useEffect(() => {
    if (!shouldLoadCardData || status !== undefined || !onStatusChange || (!vtuber.chzzk_channel_id && !vtuber.soop_channel_id)) return;
    const query = vtuber.chzzk_channel_id ? `chzzkId=${encodeURIComponent(vtuber.chzzk_channel_id)}` : `soopId=${encodeURIComponent(vtuber.soop_channel_id || '')}`;
    fetch(`/api/live-status?${query}`, { cache: 'no-store' }).then((response) => response.json()).then((data: { isLive?: boolean }) => onStatusChange({ vtuber_id: '', platform: vtuber.chzzk_channel_id ? 'chzzk' : 'soop', is_live: data.isLive === true, updated_at: new Date().toISOString() })).catch(() => onStatusChange(null));
  }, [onStatusChange, shouldLoadCardData, status, vtuber.chzzk_channel_id, vtuber.soop_channel_id]);

  return (
    <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
      <div>
        <h3 className="text-lg font-bold text-white mb-3">{vtuber.name}</h3>
        <p className="text-xs text-slate-400">{status ? (status.is_live ? 'LIVE ON' : 'LIVE OFF') : 'CHECKING'}</p>
      </div>

      <div className="flex gap-2 text-xs font-semibold pt-4 border-t border-slate-800">
        {/* 주력 방송 플랫폼 버튼 (치지직 or SOOP) */}
        {liveUrl && (
          <a
            href={liveUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 hover:bg-emerald-900 transition"
          >
            {vtuber.chzzk_channel_id ? '치지직 ↗' : 'SOOP ↗'}
          </a>
        )}

        {/* 유튜브 버튼 */}
        {vtuber.youtube_url && (
          <a
            href={vtuber.youtube_url}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded bg-red-950 text-red-400 border border-red-800 hover:bg-red-900 transition"
          >
            유튜브 ↗
          </a>
        )}

        {/* 팬카페 버튼 */}
        {vtuber.cafe_url && (
          <a
            href={vtuber.cafe_url}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded bg-blue-950 text-blue-400 border border-blue-800 hover:bg-blue-900 transition"
          >
            팬카페 ↗
          </a>
        )}
      </div>
      <div className="mt-4 border-t border-slate-800 pt-3">
        <div className="flex gap-3 text-xs font-bold"><button type="button" onClick={() => setActiveTab('video')} className={activeTab === 'video' ? 'text-red-400' : 'text-slate-500'}>🎵 최근 커버곡/영상</button><button type="button" onClick={() => setActiveTab('notice')} className={activeTab === 'notice' ? 'text-red-400' : 'text-slate-500'}>📢 소식</button></div>
        {activeTab === 'video' && <div className="mt-3 text-xs text-slate-400">{videoLoading ? '최근 영상을 불러오는 중...' : latestVideo ? <a href={latestVideo.url} target="_blank" rel="noreferrer" className="font-bold text-white hover:text-red-400">{latestVideo.title}</a> : '최근 영상 정보가 없습니다.'}</div>}
        {activeTab === 'notice' && <p className="mt-3 text-xs text-slate-400">새로운 공지 정보가 없습니다.</p>}
      </div>
    </div>
  );
}