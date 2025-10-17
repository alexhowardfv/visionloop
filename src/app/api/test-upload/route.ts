import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Upload proxy route is working',
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const authHeader = request.headers.get('authorization');

    return NextResponse.json({
      message: 'Test upload endpoint working',
      hasAuth: !!authHeader,
      formDataKeys: Array.from(formData.keys()),
      authPreview: authHeader ? authHeader.substring(0, 30) + '...' : 'NO AUTH',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Test failed', details: String(error) },
      { status: 500 }
    );
  }
}
