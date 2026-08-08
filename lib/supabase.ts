import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

// Cookie Storage Helper per sincronizzare la sessione client-side con il Next.js Server-Side Middleware
const customCookieStorage = {
  getItem: (key: string) => {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${key}=`);
    if (parts.length === 2) {
      const rawValue = parts.pop()?.split(';').shift() || '';
      return decodeURIComponent(rawValue);
    }
    return null;
  },
  setItem: (key: string, value: string) => {
    if (typeof document === 'undefined') return;
    const date = new Date();
    // Il cookie dura 30 giorni
    date.setTime(date.getTime() + (30 * 24 * 60 * 60 * 1000));
    document.cookie = `${key}=${encodeURIComponent(value)}; expires=${date.toUTCString()}; path=/; SameSite=Lax; Secure`;
  },
  removeItem: (key: string) => {
    if (typeof document === 'undefined') return;
    document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax; Secure`;
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customCookieStorage,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});
