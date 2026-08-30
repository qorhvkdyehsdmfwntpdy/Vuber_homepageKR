import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 버튜버가 아닌 일반 나무위키 문서 키워드 및 단어 블랙리스트
const INVALID_NAMES = [
  '버추얼 유튜버', '한국', '목록', '활동 중', '활동 중단', '활동 종료',
  '하위 문서', '상위 문서', '개요', '특징', '기타', '둘러보기', '프로필',
  '트위치', '치지직', 'SOOP', '아프리카TV', '유튜브', '팬카페', '네이버 카페',
  '스텔라이브', '이세돌', '이세계 아이돌', '플레이브', 'PLAVE', 'Vspo', 'NIJISANJI'
];

async function cleanDatabase() {
  console.log('🧹 Supabase DB 데이터 정제 작업을 시작합니다...');

  // 1. 전체 데이터 가져오기
  const { data: vtubers, error } = await supabase.from('vtubers').select('*');
  
  if (error || !vtubers) {
    console.error('❌ DB 조회 실패:', error);
    return;
  }

  console.log(`📊 현재 총 등록 데이터 수: ${vtubers.length}개`);

  const idsToDelete: string[] = [];
  const seenNames = new Set<string>();

  for (const vtuber of vtubers) {
    const name = vtuber.name.trim();

    // [기준 4] 중복 데이터 검사
    if (seenNames.has(name)) {
      idsToDelete.push(vtuber.id);
      continue;
    }
    seenNames.add(name);

    // [기준 2 & 3] 버튜버가 아니거나 불필요한 나무위키 일반 단어/문장 필터링
    const isInvalidName =
      INVALID_NAMES.includes(name) ||
      name.startsWith('틀:') ||
      name.startsWith('분류:') ||
      name.includes('나무위키') ||
      name.length < 2 ||
      name.length > 25; // 일반적인 닉네임 길이를 초과하는 문장 제외

    if (isInvalidName) {
      idsToDelete.push(vtuber.id);
      continue;
    }

    // [기준 1] 연동된 플랫폼 정보가 하나도 없는 가짜/미연동 데이터 정리
    // (치지직, SOOP, 유튜브 ID 중 최소 1개는 존재해야 실제 버튜버로 인정)
    const hasNoPlatform =
      !vtuber.chzzk_channel_id &&
      !vtuber.soop_channel_id &&
      !vtuber.youtube_channel_id;

    // ※ 초기 대량 수집 직후 플랫폼 ID가 완전히 비어있는 노이즈 행 삭제 처리
    if (hasNoPlatform && vtubers.length > 50) {
      idsToDelete.push(vtuber.id);
    }
  }

  console.log(`🗑️ 삭제 대상 노이즈 데이터 수: ${idsToDelete.length}개`);

  // 2. 삭제 대상 일괄 제거 (Bulk Delete)
  if (idsToDelete.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < idsToDelete.length; i += chunkSize) {
      const chunk = idsToDelete.slice(i, i + chunkSize);
      const { error: deleteError } = await supabase
        .from('vtubers')
        .delete()
        .in('id', chunk);

      if (deleteError) {
        console.error('❌ 삭제 처리 중 에러:', deleteError);
      }
    }
    console.log('✅ 노이즈 데이터가 모두 깔끔하게 정리되었습니다!');
  } else {
    console.log('✨ 더 이상 정리할 노이즈 데이터가 없습니다.');
  }
}

cleanDatabase();