import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge'; // Recommended for proxying files

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Extract the access token
    const accessToken = formData.get('accessToken') as string;
    
    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Missing access token in FormData' },
        { status: 401 }
      );
    }

    // Remove accessToken from formData before forwarding (cleaner payload)
    formData.delete('accessToken');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return NextResponse.json(
        { success: false, error: 'Supabase URL not configured' },
        { status: 500 }
      );
    }

    // Forward to Supabase Edge Function
    const response = await fetch(
      `${supabaseUrl}/functions/v1/universal-excel-upload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          // Do NOT set Content-Type; fetch sets the boundary automatically
        },
        body: formData,
      }
    );

    const data = await response.json();

    // FIX: Check for 'message' first, as that is what the Edge Function returns
    if (!response.ok || data.success === false) {
      return NextResponse.json(
        {
          success: false,
          // The Edge Function returns the human-readable string in 'message'
          error: data.message || data.error || 'Upload failed', 
          details: data.details || data,
          error_code: data.error_code
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);

  } catch (error: any) {
    console.error('API route proxy error:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Proxy Error: ${error.message}`,
      },
      { status: 500 }
    );
  }
}