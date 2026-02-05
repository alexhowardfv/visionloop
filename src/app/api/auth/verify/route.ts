import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Get host from request body (passed from client Settings) or fallback to env variable
    const socketHost = body.socketHost || process.env.NEXT_PUBLIC_SOCKET_HOST || 'localhost';
    const authUrl = `http://${socketHost}/api/capture/auth/verify_account`;

    console.log('[Auth Proxy] Forwarding request to backend:', body);
    console.log('[Auth Proxy] Using socket host:', socketHost);
    console.log('[Auth Proxy] Target URL (verify):', authUrl);

    // Step 1: Verify the PIN with POST to /verify_account
    const verifyResponse = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'From': 'http://localhost',
      },
      body: JSON.stringify(body),
    });

    console.log('[Auth Proxy] Verify response status:', verifyResponse.status, verifyResponse.statusText);

    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text();
      console.error('[Auth Proxy] Verify failed:', errorText);
      return NextResponse.json(
        { error: 'Verification failed', details: errorText },
        { status: verifyResponse.status }
      );
    }

    const verifyData = await verifyResponse.json();
    console.log('[Auth Proxy] ========== FULL /verify_account RESPONSE ==========');
    console.log('[Auth Proxy] Response Status:', verifyResponse.status);
    console.log('[Auth Proxy] Response Headers:', Object.fromEntries(verifyResponse.headers.entries()));
    console.log('[Auth Proxy] Response Body (stringified):', JSON.stringify(verifyData, null, 2));

    // Try to decode and log user_id from access_token
    if (verifyData.access_token?.token) {
      try {
        const tokenParts = verifyData.access_token.token.split('.');
        if (tokenParts.length >= 2) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          console.log('[Auth Proxy] DECODED USER FROM access_token:', payload.sub);
          console.log('[Auth Proxy] TOKEN AUDIENCE:', payload.aud);
        }
      } catch (e) {
        console.log('[Auth Proxy] Could not decode access_token');
      }
    }

    // Check user_info for user details
    if (verifyData.user_info?.logged_in_as) {
      console.log('[Auth Proxy] USER FROM user_info:', verifyData.user_info.logged_in_as.user_id);
      console.log('[Auth Proxy] USER EMAIL:', verifyData.user_info.logged_in_as.email);
      console.log('[Auth Proxy] SOCKET HOST PROVIDED:', socketHost);

      // Log project permissions to see which projects this user has access to
      const projectPerms = verifyData.user_info.logged_in_as.app_metadata?.permissions?.projects;
      if (projectPerms) {
        console.log('[Auth Proxy] USER HAS ACCESS TO PROJECTS:', Object.keys(projectPerms));
      }
    }

    // Check if there's a separate user_id field at top level
    if (verifyData.user_id) {
      console.log('[Auth Proxy] USER_ID FIELD (top-level):', verifyData.user_id);
    }

    console.log('[Auth Proxy] ==================================================');

    // Return the verify_account response directly (contains both id_token and access_token)
    return NextResponse.json(verifyData, { status: 200 });
  } catch (error) {
    console.error('[Auth Proxy] Error:', error);
    console.error('[Auth Proxy] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      { error: 'Authentication failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
