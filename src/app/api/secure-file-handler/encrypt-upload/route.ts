import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { documentType, files, accessToken } = await request.json();

  try {
    const response = await fetch('https://ukjukfdhphynbfuusntv.supabase.co/functions/v1/secure-file-handler/encrypt-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ documentType, files }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({ error: errorData.error || 'Failed to upload files via Supabase Edge Function' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in encrypt-upload proxy API route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}