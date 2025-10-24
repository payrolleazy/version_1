import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  let config_id, accessToken;
  try {
    ({ config_id, accessToken } = await request.json());
  } catch (error) {
    console.error('Error parsing request body:', error);
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  if (!config_id || !accessToken) {
    return NextResponse.json({ error: 'Missing config_id or accessToken' }, { status: 400 });
  }

  try {
    const response = await fetch('https://ukjukfdhphynbfuusntv.supabase.co/functions/v1/a_crud_universal_read', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ config_id }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({ error: errorData.error || 'Failed to fetch from Supabase Edge Function' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in proxy API route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}