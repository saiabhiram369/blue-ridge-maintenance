import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const FALLBACK_URL = 'https://rpdfkbvjqhhaubrvnepw.supabase.co';
const FALLBACK_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZGZrYnZqcWhoYXVicnZuZXB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNzQ1NzksImV4cCI6MjA4OTk1MDU3OX0.3qu_V8mGKhHxpvR1XUsmojoFNX2VIhLBryzBozEdzzQ';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || FALLBACK_URL;
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || FALLBACK_ANON_KEY;

export const supabase: SupabaseClient = createClient(url, anonKey);

export const forcedDemo = new URLSearchParams(window.location.search).get('demo') === '1';
export const demoMode = forcedDemo;
