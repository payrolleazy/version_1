import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { job, accessToken } = await request.json();

    if (!job || !accessToken) {
      return NextResponse.json({ success: false, message: 'Missing job details or access token' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Direct call to the Deno Worker
    const response = await fetch(`${supabaseUrl}/functions/v1/wcm-esic-worker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`, // Pass user token for RLS
      },
      body: JSON.stringify({ job }),
    });

    const data = await response.json();

    if (!response.ok) {
        return NextResponse.json({ success: false, message: data.error || 'Worker failed to start' }, { status: response.status });
    }

    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Worker Trigger Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}