'use client';

import { FormEvent, useCallback, useState } from 'react';

type Platform = 'chzzk' | 'soop';
type CrawlResult = {
  name: string;
  platform: Platform;
  namuVerified: boolean;
  chzzkId: string | null;
  soopId: string | null;
  youtubeUrl: string | null;
  cafeUrl: string | null;
  profileImageUrl: string | null;
  youtubeChannelId?: string | null;
};

const FALLBACK_IMAGE_URL = 'https://placehold.co/150x150?text=VTuber';

const fieldLabels: [keyof CrawlResult, string][] = [
  ['chzzkId', '치지직 ID'],
  ['soopId', 'SOOP ID'],
  ['youtubeUrl', 'YouTube'],
  ['cafeUrl', '네이버 카페'],
  ['profileImageUrl', '프로필 이미지'],
];

function normalizeStoredUrl(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return trimmed;
}

function renderFieldValue(key: keyof CrawlResult, value: string | boolean | null | undefined) {
  const normalized = typeof value === 'string' ? normalizeStoredUrl(value) : null;

  if (key === 'profileImageUrl') {
    const imageUrl = normalized || FALLBACK_IMAGE_URL;
    return (
      <div className="mt-3 flex items-center gap-3">
        <img
          src={imageUrl}
          alt="프로필 이미지 미리보기"
          className="h-16 w-16 rounded-full border border-[#d9d5cc] bg-[#f4f1eb] object-cover"
          onError={(event) => {
            const target = event.currentTarget;
            if (target.src !== FALLBACK_IMAGE_URL) {
              target.src = FALLBACK_IMAGE_URL;
            }
          }}
        />
        <span className="break-all text-sm font-bold text-[#161616]">{normalized || '프로필 이미지 없음'}</span>
      </div>
    );
  }

  if (!normalized) return <span className="text-[#8b8479]">수집되지 않음</span>;

  const isLink = normalized.startsWith('http://') || normalized.startsWith('https://');
  if (!isLink) return <span>{normalized}</span>;

  return (
    <a href={normalized} target="_blank" rel="noreferrer" className="break-all text-[#161616] underline decoration-2 underline-offset-2">
      {normalized}
    </a>
  );
}

export default function AddVtuberPage() {
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState<Platform>('chzzk');
  const [result, setResult] = useState<CrawlResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleCrawl = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !platform) {
      setMessage('버튜버 이름과 주력 플랫폼을 입력해 주세요.');
      return;
    }

    setLoading(true);
    setMessage('');
    setResult(null);

    try {
      const response = await fetch(`/api/admin/crawl?keyword=${encodeURIComponent(name.trim())}&platform=${platform}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '정보 수집에 실패했습니다.');
      setResult(data as CrawlResult);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '정보 수집에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [name, platform]);

  async function handleSave() {
    if (!result) {
      setMessage('먼저 수집된 데이터가 있는지 확인해 주세요.');
      return;
    }

    const safeName = result.name?.trim();
    const safePlatform = result.platform === 'chzzk' || result.platform === 'soop' ? result.platform : null;

    if (!safeName) {
      setMessage('버튜버 이름이 비어 있어 저장할 수 없습니다.');
      return;
    }

    if (!safePlatform) {
      setMessage('플랫폼 정보가 올바르지 않습니다.');
      return;
    }

    const selectedProfileImage = normalizeStoredUrl(result.profileImageUrl);
    const payload = {
      name: safeName,
      platform: safePlatform,
      chzzk_channel_id: (result.chzzkId || '').trim() || null,
      soop_channel_id: (result.soopId || '').trim() || null,
      youtube_url: normalizeStoredUrl(result.youtubeUrl),
      cafe_url: normalizeStoredUrl(result.cafeUrl),
      profile_image_url: selectedProfileImage,
      youtube_channel_id: (result.youtubeChannelId || '').trim() || null,
    };

    console.log('[ADMIN][save] payload to Supabase', payload);
    console.log('[ADMIN][save] selected profileImg (user override priority)', {
      crawledProfileImageUrl: normalizeStoredUrl(result.profileImageUrl),
      manualOverrideUsed: Boolean(result.profileImageUrl && result.profileImageUrl.trim()),
      finalProfileImageUrl: payload.profile_image_url,
    });

    setSaving(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/add-vtuber', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            ...result,
            name: safeName,
            platform: safePlatform,
            chzzkId: payload.chzzk_channel_id,
            soopId: payload.soop_channel_id,
            youtubeUrl: payload.youtube_url,
            cafeUrl: payload.cafe_url,
            profileImageUrl: payload.profile_image_url,
            youtubeChannelId: payload.youtube_channel_id,
          }],
        }),
      });

      const data = (await response.json()) as { error?: string; data?: unknown; details?: unknown };
      console.log('[ADMIN][save] DB response', { status: response.status, ok: response.ok, data, error: data?.error ?? null });

      if (!response.ok) {
        throw new Error(data.error || '저장에 실패했습니다.');
      }

      setMessage('저장했습니다.');
    } catch (error) {
      setMessage(`저장 실패: ${error instanceof Error ? error.message : '서버에 연결할 수 없습니다.'}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f1eb] px-5 py-10 text-[#161616] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-4xl">
        <header className="border-b-2 border-[#161616] pb-7">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-[#ee4635]">VTUBER HUB / ADMIN</p>
          <h1 className="text-4xl font-black tracking-[-0.07em] sm:text-5xl">버튜버 정보 등록</h1>
          <p className="mt-3 text-sm text-[#716c64]">버튜버 이름 또는 유튜브 핸들(예: @INE_)을 입력하면 공식 채널 정보를 빠르게 확인합니다.</p>
        </header>

        <form onSubmit={handleCrawl} className="mt-8 border border-[#d9d5cc] bg-[#fffdfa] p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            <label className="flex-1 text-xs font-bold text-[#716c64]">
              버튜버 이름 또는 유튜브 핸들
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="예: 아이네 / @INE_"
                className="mt-2 h-12 w-full border border-[#d9d5cc] bg-white px-4 text-base font-bold outline-none focus:border-[#161616]"
              />
            </label>

            <fieldset className="flex gap-2">
              <legend className="mb-2 block text-xs font-bold text-[#716c64]">주력 플랫폼</legend>
              {(['chzzk', 'soop'] as Platform[]).map((item) => (
                <label
                  key={item}
                  className={`flex h-12 cursor-pointer items-center border px-4 text-xs font-black ${platform === item ? 'border-[#161616] bg-[#161616] text-white' : 'border-[#d9d5cc] bg-white text-[#716c64]'}`}
                >
                  <input type="radio" name="platform" value={item} checked={platform === item} onChange={() => setPlatform(item)} className="sr-only" />
                  {item === 'chzzk' ? '치지직' : 'SOOP'}
                </label>
              ))}
            </fieldset>

            <button type="submit" disabled={loading} className="h-12 bg-[#ee4635] px-6 text-sm font-black text-white transition hover:bg-[#d93629] disabled:cursor-wait disabled:opacity-60">
              {loading ? '수집 중...' : '정보 수집'}
            </button>
          </div>
        </form>

        {message && (
          <p role="status" className={`mt-4 text-sm font-bold ${message.startsWith('저장했습니다') ? 'text-[#198754]' : 'text-[#ee4635]'}`}>
            {message}
          </p>
        )}

        {result && (
          <section className="mt-8 border border-[#d9d5cc] bg-[#fffdfa]" aria-label="수집 결과 미리보기">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d9d5cc] p-5">
              <div className="flex items-center gap-4">
                <img
                  src={normalizeStoredUrl(result.profileImageUrl) || FALLBACK_IMAGE_URL}
                  alt={result.name}
                  className="h-16 w-16 rounded-full border border-[#d9d5cc] bg-[#f4f1eb] object-cover"
                  onError={(event) => {
                    const target = event.currentTarget;
                    if (target.src !== FALLBACK_IMAGE_URL) {
                      target.src = FALLBACK_IMAGE_URL;
                    }
                  }}
                />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8b8479]">Preview</p>
                  <h2 className="mt-1 text-2xl font-black">{result.name}</h2>
                </div>
              </div>

              <span className={`text-xs font-black ${result.namuVerified ? 'text-[#198754]' : 'text-[#9d988f]'}`}>
                {result.namuVerified ? '✓ 나무위키 검증됨' : '○ 나무위키 미확인'}
              </span>
            </div>

            <dl className="grid gap-px bg-[#e9e5dd] sm:grid-cols-2">
              {fieldLabels.map(([key, label]) => (
                <div key={key} className="bg-[#fffdfa] p-5">
                  <dt className="text-xs font-bold text-[#8b8479]">{label}</dt>
                  <dd className="mt-2 break-all text-sm font-bold">{renderFieldValue(key, result[key])}</dd>
                </div>
              ))}
            </dl>

            <div className="border-t border-[#d9d5cc] bg-[#fffdfa] p-5">
              <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[#716c64]">
                프로필 이미지 URL
              </label>
              <input
                value={result.profileImageUrl ?? ''}
                onChange={(event) => {
                  setResult((current) =>
                    current
                      ? {
                          ...current,
                          profileImageUrl: event.target.value.trim(),
                        }
                      : current
                  );
                }}
                placeholder="https://..."
                className="mt-2 h-12 w-full border border-[#d9d5cc] bg-white px-4 text-sm font-bold outline-none focus:border-[#161616]"
              />
            </div>

            <div className="flex justify-end border-t border-[#d9d5cc] p-5">
              <button type="button" onClick={handleSave} disabled={saving} className="bg-[#161616] px-6 py-3 text-sm font-black text-white transition hover:bg-[#ee4635] disabled:opacity-60">
                {saving ? '저장 중...' : '최종 저장'}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
