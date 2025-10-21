import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing environment variables for Supabase')
}

console.log('Supabase URL being used:', supabaseUrl);
console.log('Supabase Anon Key being used:', supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
