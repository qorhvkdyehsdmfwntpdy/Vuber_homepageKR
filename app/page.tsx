'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import VTuberCard from '@/components/VTuberCard';
import type { LiveStatus, VTuber } from '@/types/vtuber';

type Filter = 'all' | 'chzzk' | 'soop';
type ExtendedVTuber = VTuber & { group_name?: string };

function Skeleton() {
  return <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-52 animate-pulse border border-[#d9d5cc] bg-[#fffdfa] p-5"><div className="h-7 w-2/3 bg-[#e5e0d7]" /><div className="mt-5 h-4 w-full bg-[#e5e0d7]" /><div className="mt-9 h-8 w-1/2 bg-[#e5e0d7]" /></div>)}</div>;
}

export default function HomePage() {
  const [vtubers, setVtubers] = useState<VTuber[]>([]);
  const [statuses, setStatuses] = useState<Record<string, LiveStatus | null>>({});
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [group, setGroup] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('vtubers').select('*').then(({ data }) => {
      setVtubers((data as VTuber[]) || []);
      setLoading(false);
    });
  }, []);

  const groups = useMemo(() => ['all', ...new Set(vtubers.map((item) => (item as ExtendedVTuber).group_name).filter(Boolean) as string[])], [vtubers]);
  const visible = useMemo(() => vtubers.filter((item) => {
    const extended = item as ExtendedVTuber;
    const matchesQuery = item.name.toLowerCase().includes(query.toLowerCase());
    const matchesPlatform = filter === 'all' || (filter === 'chzzk' ? Boolean(item.chzzk_channel_id) : Boolean(item.soop_channel_id));
    return matchesQuery && matchesPlatform && (group === 'all' || extended.group_name === group);
  }).sort((a, b) => Number(statuses[b.id]?.is_live) - Number(statuses[a.id]?.is_live)), [filter, group, query, statuses, vtubers]);

  return <main className="min-h-screen bg-[#f4f1eb] px-5 py-8 text-[#161616] sm:px-8 lg:px-12"><div className="mx-auto max-w-7xl">
    <header className="border-b-2 border-[#161616] pb-6"><p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-[#ee4635]">VTUBER HUB / DIRECTORY</p><h1 className="text-4xl font-black tracking-[-0.07em] sm:text-6xl">오늘의 방송 편성표</h1><p className="mt-3 text-sm text-[#716c64]">실시간 방송 상태와 새 콘텐츠를 한눈에 확인하세요.</p></header>
    <div className="flex flex-col gap-4 border-b border-[#d9d5cc] py-5 lg:flex-row lg:items-center"><label className="flex-1"><span className="sr-only">버튜버 검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="버튜버 이름 검색" className="h-11 w-full border border-[#d9d5cc] bg-[#fffdfa] px-4 text-sm font-bold outline-none focus:border-[#161616]" /></label><div className="flex gap-2 overflow-x-auto">{(['all', 'chzzk', 'soop'] as Filter[]).map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`h-11 shrink-0 border px-4 text-xs font-black ${filter === item ? 'border-[#161616] bg-[#161616] text-white' : 'border-[#d9d5cc] bg-[#fffdfa] text-[#716c64]'}`}>{item === 'all' ? '전체 플랫폼' : item === 'chzzk' ? '치지직' : 'SOOP'}</button>)}</div><select value={group} onChange={(event) => setGroup(event.target.value)} className="h-11 border border-[#d9d5cc] bg-[#fffdfa] px-4 text-xs font-black outline-none"><option value="all">전체 소속</option>{groups.slice(1).map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
    <div className="flex items-center justify-between border-b border-[#d9d5cc] py-4"><p className="text-xs font-bold text-[#716c64]">{visible.length} CHANNELS FOUND</p><span className="text-xs font-bold text-[#8b8479]">LIVE API CONNECTED</span></div>
    {loading ? <div className="py-6"><Skeleton /></div> : visible.length === 0 ? <p className="py-20 text-center text-sm text-[#716c64]">조건에 맞는 버튜버가 없습니다.</p> : <section className="grid grid-cols-1 gap-5 py-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="버튜버 목록">{visible.map((vtuber) => <VTuberCard key={vtuber.id} vtuber={vtuber} status={statuses[vtuber.id]} onStatusChange={(status) => setStatuses((current) => ({ ...current, [vtuber.id]: status }))} />)}</section>}
  </div></main>;
}
