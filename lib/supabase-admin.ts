import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseAdminConfigured = Boolean(supabaseUrl && serviceRoleKey);

export function createSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.');
  if (serviceRoleKey === 'placeholder' || !serviceRoleKey.startsWith('eyJ')) {
    throw new Error('Supabase service role key 형식이 올바르지 않습니다. Supabase 콘솔에서 새 키를 발급해 .env.local에 다시 설정해주세요.');
  }
  return createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}