import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'; // Import the exported supabase instance

export async function POST(request: Request) {
  const requestBody = await request.text();
  if (!requestBody) {
    return NextResponse.json({ success: false, message: 'Request body is empty' }, { status: 400 });
  }

  let parsedBody;
  try {
    parsedBody = JSON.parse(requestBody);
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Invalid JSON in request body' }, { status: 400 });
  }

  const { config_id, params, accessToken } = parsedBody;

  if (!config_id || !accessToken) {
    return NextResponse.json({ success: false, message: 'Missing config_id or accessToken' }, { status: 400 });
  }

  try {
    // Use the imported supabase instance directly
    // const supabase = createClient(); // REMOVED
    const { data, error } = await supabase.functions.invoke('a_crud_universal_read', {
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
