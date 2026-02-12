import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { p_arrear_master_id } = await request.json();

    if (!p_arrear_master_id) {
      return NextResponse.json({ success: false, message: 'p_arrear_master_id is required' }, { status: 400 });
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, message: 'Authorization header is required' }, { status: 401 });
    }

    // Call the Supabase Edge Function via the universal PG function gateway
    const supabaseEdgeFunctionUrl = process.env.NEXT_PUBLIC_SUPABASE_URL + '/functions/v1/a_crud_universal_pg_function_gateway';
    const response = await fetch(supabaseEdgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        config_id: 'wcm-get-arrear-breakdown-details', // The ID we just configured
        params: { p_arrear_master_id }
      }),
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