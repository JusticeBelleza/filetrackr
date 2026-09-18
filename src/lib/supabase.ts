import { createClient } from '@supabase/supabase-js';

// Provide syntactically valid fallback strings so the app doesn't hard-crash on load.
// This allows main.tsx to safely catch the missing envs and display the Configuration Error screen.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://missing-env.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'missing-key';

// Your normal, shared client for public/authenticated users
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        experimental: { 
            passkey: true 
        }
    }
});