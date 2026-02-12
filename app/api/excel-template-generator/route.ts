import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  const { config_id, params, accessToken } = await request.json();

  if (!config_id || !accessToken) {
    return NextResponse.json({ success: false, message: 'Missing config_id or accessToken' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase.functions.invoke('excel-template-generator', {
      body: { config_id, params },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (error) {
      console.error('Edge Function error:', error);
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e: any) {
    console.error('API route error:', e);
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}
