import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const projectId = params.projectId;
    const formData = await request.formData();

    console.log('[Upload Proxy] Forwarding upload to backend for project:', projectId);
    console.log('[Upload Proxy] FormData entries:', Array.from(formData.entries()).map(([key, value]) => ({
      key,
      type: value instanceof File ? 'File' : typeof value,
      size: value instanceof File ? value.size : 'N/A',
      name: value instanceof File ? value.name : 'N/A',
    })));

    const authHeader = request.headers.get('authorization');
    console.log('[Upload Proxy] Authorization header present:', !!authHeader);
    console.log('[Upload Proxy] Authorization header preview:', authHeader ? authHeader.substring(0, 30) + '...' : 'NO AUTH');

    if (!authHeader) {
      console.error('[Upload Proxy] Missing authorization header');
      return NextResponse.json(
        { error: 'No authorization token provided' },
        { status: 401 }
      );
    }

    const targetUrl = `https://v1.cloud.flexiblevision.com/api/capture/annotations/upload/${projectId}`;
    console.log('[Upload Proxy] Target URL:', targetUrl);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'From': 'http://localhost',
      },
      body: formData,
    });

    console.log('[Upload Proxy] Backend response status:', response.status, response.statusText);
    console.log('[Upload Proxy] Backend response headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('[Upload Proxy] Backend response text:', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
      console.log('[Upload Proxy] Parsed response data:', data);
    } catch (parseError) {
      console.error('[Upload Proxy] Failed to parse response as JSON:', parseError);
      return NextResponse.json(
        { error: 'Invalid response from backend', details: responseText },
        { status: 502 }
      );
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Upload Proxy] Error:', error);
    console.error('[Upload Proxy] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
