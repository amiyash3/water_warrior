import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { createSupabaseApi } from '@/api/supabaseApi';
import { localApi } from '@/api/localClient';

/** @type {ReturnType<typeof createSupabaseApi> | typeof localApi} */
export const api = isSupabaseConfigured ? createSupabaseApi(supabase) : localApi;

export { isSupabaseConfigured };
