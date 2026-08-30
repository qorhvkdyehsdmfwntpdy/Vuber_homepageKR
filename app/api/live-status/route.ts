import { NextResponse } from 'next/server';

type ChzzkResponse = {
  content?: {
    status?: string;
  };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chzzkId = searchParams.get('chzzkId');
  const soopId = searchParams.get('soopId');

  if (chzzkId) {
    try {
      const response = await fetch(
        `https://api.chzzk.naver.com/service/v1/channels/${encodeURIComponent(chzzkId)}/live-detail`,
        { cache: 'no-store' },
      );
      if (!response.ok) return NextResponse.json({ isLive: false });
      const data = (await response.json()) as ChzzkResponse;
      return NextResponse.json({ isLive: data.content?.status === 'OPEN' });
    } catch {
      return NextResponse.json({ isLive: false });
    }
  }

  if (soopId) return NextResponse.json({ isLive: false });

  return NextResponse.json({ isLive: false });
}
