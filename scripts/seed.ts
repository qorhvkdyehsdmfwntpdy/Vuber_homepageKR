import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const NAMU_URL =
  'https://namu.wiki/w/%EB%B2%84%EC%B8%84%EC%96%BC%20%EC%9C%A0%ED%8A%9C%EB%B2%84/%EB%AA%A9%EB%A1%9D/%ED%95%9C%EA%B5%AD';

async function runSeed() {
  console.log('🔍 나무위키 한국 버튜버 목록 수집을 시작합니다...');

  try {
    const response = await fetch(NAMU_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const html = await response.text();
    const $ = cheerio.load(html);
    const vtubers: { name: string }[] = [];

    const excludeKeywords = [
      '나무위키', '토론', '편집', '역사', '버추얼 유튜버', '분류', '토막글',
      '목록', '한국', '활동 중', '활동 중단', '활동 종료', '둘러보기', '프로필',
      '문서', '하위', '상위', '주의사항', '개요', '특징', '기타'
    ];

    $('a[href^="/w/"]').each((_, el) => {
      const title = $(el).text().trim();
      
      // 2글자 이상 ~ 40글자 이하의 이름만 수집 (DB 100자 제한 안전 통과)
      if (
        title &&
        title.length >= 2 &&
        title.length <= 40 &&
        !excludeKeywords.some((keyword) => title.includes(keyword))
      ) {
        if (!vtubers.some((v) => v.name === title)) {
          vtubers.push({ name: title });
        }
      }
    });

    console.log(`📦 필터링 완료된 버튜버 수: ${vtubers.length}명`);

    // 100개씩 나누어 안전하게 Bulk Insert (DB 과부하 방지)
    const chunkSize = 100;
    for (let i = 0; i < vtubers.length; i += chunkSize) {
      const chunk = vtubers.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('vtubers')
        .upsert(chunk, { onConflict: 'name' });

      if (error) {
        console.error(`❌ ${i + 1}~${i + chunk.length}번째 데이터 저장 실패:`, error);
      }
    }

    console.log(`🎉 성공적으로 Supabase DB에 데이터 배치가 완료되었습니다!`);
  } catch (err) {
    console.error('💥 스크립트 실행 중 오류 발생:', err);
  }
}

runSeed();