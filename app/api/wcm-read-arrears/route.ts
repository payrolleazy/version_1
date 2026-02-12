import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { config_id, params } = await request.json();

    if (!config_id) {
      return NextResponse.json({ success: false, message: 'config_id is required' }, { status: 400 });
    }

    // Get the Authorization header from the incoming request
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, message: 'Authorization header is required' }, { status: 401 });
    }

    // Call the Supabase Edge Function
    const supabaseEdgeFunctionUrl = process.env.NEXT_PUBLIC_SUPABASE_URL + '/functions/v1/a_crud_universal_read';
    const response = await fetch(supabaseEdgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader, // Pass through the Authorization header
      },
      body: JSON.stringify({ config_id, params }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('API route error:', error);
    return NextResponse.json({ success: false, message: error.message || 'An unexpected error occurred' }, { status: 500 });
  }
}
