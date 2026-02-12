import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'; // Import the exported supabase instance

export async function POST(request: Request) {
  const { config_id, params, accessToken } = await request.json();

  if (!config_id || !accessToken) {
    return NextResponse.json({ success: false, message: 'Missing config_id or accessToken' }, { status: 400 });
  }

  try {
    // Use the imported supabase instance directly
    // const supabase = createClient(); // REMOVED
    const { data, error } = await supabase.functions.invoke('a_crud_universal_pg_function_gateway', {
      body: { config_id, params }, // params will contain user_roles_data
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
