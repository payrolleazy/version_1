import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  let accessToken;
  try {
    const requestBody = await request.json();
    accessToken = requestBody.accessToken; // Extract accessToken
    console.log('API Route: Received request body:', requestBody); // DEBUG
    console.log('API Route: Extracted accessToken:', accessToken); // DEBUG
  } catch (error) {
    console.error('API Route: Error parsing request body:', error);
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  if (!accessToken) {
    console.error('API Route: accessToken is missing or empty.'); // DEBUG
    return NextResponse.json({ error: 'Missing accessToken in request body' }, { status: 400 });
  }

  try {
    console.log('API Route: Attempting to call Edge Function with accessToken:', accessToken ? 'present' : 'missing'); // DEBUG
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/a_crud_universal_pg_function_gateway`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ config_id: "emp-onboarding-dashboard-data", params: {} }),
    });

    console.log('API Route: Received response from Edge Function. Status:', response.status); // DEBUG

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API Route: Edge Function returned error:', errorData); // DEBUG
      return NextResponse.json({ error: errorData.error || 'Failed to fetch from Supabase Edge Function' }, { status: response.status });
    }

    const data = await response.json();
    console.log('API Route: Successfully fetched data from Edge Function.'); // DEBUG
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('API Route: Error during Edge Function fetch or processing:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
