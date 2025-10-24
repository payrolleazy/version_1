import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const documentType = searchParams.get('documentType');
  const accessToken = searchParams.get('accessToken'); // Assuming accessToken is passed as a query param for GET

  if (!documentType || !accessToken) {
    return NextResponse.json({ error: 'Missing documentType or accessToken query parameter' }, { status: 400 });
  }

  try {
    const response = await fetch(`https://ukjukfdhphynbfuusntv.supabase.co/functions/v1/secure-file-handler/list-decrypted-files?documentType=${documentType}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({ error: errorData.error || 'Failed to list files via Supabase Edge Function' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in list-decrypted-files proxy API route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}