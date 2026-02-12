import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'; // Re-use existing Supabase client

export async function POST(request: Request) {
  const { config_id, accessToken } = await request.json();

  if (!config_id || !accessToken) {
    return NextResponse.json({ success: false, message: 'Missing config_id or accessToken' }, { status: 400 });
  }

  try {
    // Invoke the universal gateway Edge Function, passing the specific config_id for this operation
    const { data, error } = await supabase.functions.invoke('a_crud_universal_pg_function_gateway', {
      body: {
        config_id: config_id, // This will now be 'export-employee-assignments'
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (error) {
      console.error('Edge Function invocation error:', error);
      return NextResponse.json({ success: false, message: error.message || 'An unknown error occurred during function invocation.' }, { status: 500 });
    }

    return NextResponse.json(data);

  } catch (e: any) {
    console.error('API route handler error:', e);
    return NextResponse.json({ success: false, message: e.message || 'An internal server error occurred.' }, { status: 500 });
  }
}
