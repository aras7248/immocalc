import { createClient } from '@supabase/supabase-js';
import { requireSupabaseConfig } from './supabaseConfig';
const config = requireSupabaseConfig(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
export const supabase = createClient(config.url, config.key);
