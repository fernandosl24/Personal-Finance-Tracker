import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config_v2.js';

if (typeof supabase === 'undefined') {
    throw new Error('Supabase SDK not loaded. Check index.html');
}

export const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
