'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('페이지 렌더링 오류:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f1eb] px-5 py-10 text-[#161616]">
      <section className="w-full max-w-md border border-[#d9d5cc] bg-[#fffdfa] p-6 text-center sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[#ee4635]">VTUBER HUB</p>
        <h1 className="mt-3 text-2xl font-black">페이지를 불러오지 못했습니다.</h1>
        <p className="mt-3 text-sm text-[#716c64]">네트워크 상태를 확인한 뒤 다시 시도해 주세요.</p>
        <button type="button" onClick={() => reset()} className="mt-6 h-11 bg-[#161616] px-5 text-sm font-black text-white hover:bg-[#ee4635]">다시 시도</button>
      </section>
    </main>
  );
}