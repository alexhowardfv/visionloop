import { AddToProjectPayload, ImageUploadResponse } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

// Helper function to get socket host from localStorage or env
const getSocketHost = (): string => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('socketHost') || process.env.NEXT_PUBLIC_SOCKET_HOST || 'localhost';
  }
  return process.env.NEXT_PUBLIC_SOCKET_HOST || 'localhost';
};

// Helper function to convert base64 to Blob
const base64ToBlob = (base64Data: string, contentType: string = 'image/jpeg'): Blob => {
  // Remove data URL prefix if present
  const base64String = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const byteCharacters = atob(base64String);
  const byteArrays = [];

  for (let i = 0; i < byteCharacters.length; i++) {
    byteArrays.push(byteCharacters.charCodeAt(i));
  }

  return new Blob([new Uint8Array(byteArrays)], { type: contentType });
};

export class VisionLoopAPI {
  private baseUrl: string;
  private authToken: string;
  private cloudToken: string; // JWE token for cloud API uploads
  private userId: string; // Dynamic user_id from verify_account (varies by socket host)

  constructor(authToken: string = '') {
    this.baseUrl = API_BASE_URL;
    this.authToken = authToken;
    // Cloud token will be set from login response (access_token from /verify_account)
    this.cloudToken = authToken; // Initialize with same token, will be updated on login
    this.userId = ''; // Will be set from login response
  }

  // Get category index URL dynamically from localStorage
  private getCategoryIndexUrl(): string {
    const socketHost = getSocketHost();
    return process.env.NEXT_PUBLIC_CATEGORY_INDEX_URL || `http://${socketHost}:5001`;
  }

  // Get auth base URL dynamically from localStorage
  private getAuthBaseUrl(): string {
    const socketHost = getSocketHost();
    return `http://${socketHost}`;
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  getAuthToken(): string {
    return this.authToken;
  }

  setCloudToken(token: string) {
    this.cloudToken = token;
  }

  getCloudToken(): string {
    return this.cloudToken;
  }

  setUserId(userId: string) {
    this.userId = userId;
  }

  getUserId(): string {
    return this.userId;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.authToken}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getTags(model: string, version: string): Promise<{ tags: string[]; colors: Record<string, string> }> {
    try {
      // Call the category_index endpoint: http://{SOCKET_HOST}:5001/category_index/<MODEL_NAME>/<MODEL_VERSION>
      const categoryIndexUrl = this.getCategoryIndexUrl();
      const url = `${categoryIndexUrl}/category_index/${encodeURIComponent(model)}/${encodeURIComponent(version)}`;
      console.log(`[API] Fetching tags from: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[API] Received category index data:', data);

      // The API returns a category index object like { "1": {id: 1, name: "bad pin_#a74444_tagBox"}, ... }
      // Extract tag names and colors
      const tagObjects = Object.values(data) as Array<{ id: number; name: string } | string>;
      const tags: string[] = [];
      const colors: Record<string, string> = {};

      tagObjects.forEach(tag => {
        let tagName = '';

        // Handle both string and object formats
        if (typeof tag === 'string') {
          tagName = tag;
        } else {
          tagName = tag.name;
        }

        // Parse format: "bad pin_#a74444_tagBox"
        const parts = tagName.split('_');
        const cleanName = parts[0]; // "bad pin"
        const hexColor = parts.length > 1 && parts[1].startsWith('#') ? parts[1] : '#666666'; // "#a74444" or default

        tags.push(cleanName);
        colors[cleanName] = hexColor;
      });

      console.log('[API] Parsed tags:', tags);
      console.log('[API] Parsed colors:', colors);

      return { tags, colors };
    } catch (error) {
      console.error('Failed to fetch tags from category index:', error);
      // Return empty tags on error - no defaults
      return {
        tags: [],
        colors: {},
      };
    }
  }

  async login(combo: string, role: string = 'Administrator'): Promise<{ token: string }> {
    // Get socket host from localStorage to pass to server-side auth route
    const socketHost = getSocketHost();

    // Use the proxy route to avoid CORS issues
    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ combo, role, socketHost }),
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[API] Login response data:', data);

    // Extract token from response - use access_token for cloud API (has audience "https://flexiblevision/api")
    const token = data.access_token?.token || data.id_token?.token || data.token;

    if (token) {
      this.setAuthToken(token);
      // Also set the cloud token to the same access_token for cloud uploads
      this.setCloudToken(token);
      console.log('[API] Token extracted and set (using access_token for both local and cloud)');
      console.log('[API] Token preview:', token.substring(0, 50) + '...');

      // Parse user_id from token's sub claim
      try {
        const tokenParts = token.split('.');
        if (tokenParts.length >= 2) {
          const payload = JSON.parse(atob(tokenParts[1]));
          const tokenUserId = payload.sub || '';

          // Check for user_id in the response (nested in user_info.logged_in_as)
          const responseUserId = data.user_info?.logged_in_as?.user_id || tokenUserId;

          this.setUserId(responseUserId);
          console.log('[API] ==================== USER IDENTIFICATION ====================');
          console.log('[API] 👤 USER_ID extracted and set:', responseUserId);
          console.log('[API] 🌐 From socket host:', socketHost);
          console.log('[API] 📧 User email:', data.user_info?.logged_in_as?.email || 'N/A');
          console.log('[API] ================================================================');
        }
      } catch (e) {
        console.error('[API] ⚠️  Failed to parse user_id from token:', e);
      }
    } else {
      console.error('[API] No token found in login response:', data);
    }

    return { token };
  }

  async addToProject(payload: AddToProjectPayload): Promise<{ success: boolean; added: number }> {
    // Use auth base URL for adding to project (requires authentication)
    const authBaseUrl = this.getAuthBaseUrl();
    const response = await fetch(`${authBaseUrl}/api/project/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Add to project failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async uploadImageToProject(
    projectId: string,
    imageData: string,
    fileName: string,
    tags: string[] = []
  ): Promise<ImageUploadResponse> {
    const socketHost = getSocketHost();
    console.log('[API] ==================== UPLOAD IMAGE REQUEST ====================');
    console.log('[API] 🌐 SOCKET HOST (from Settings):', socketHost);
    console.log('[API] 👤 USER ID (from login):', this.userId);
    console.log('[API] 📦 Project ID:', projectId);
    console.log('[API] 📄 File name:', fileName);
    console.log('[API] 🏷️  Tags:', tags);
    console.log('[API] 🔑 Auth token present:', !!this.authToken);
    console.log('[API] 🔑 Cloud token present:', !!this.cloudToken);

    // Convert base64 to Blob
    const imageBlob = base64ToBlob(imageData);
    console.log('[API] Image blob size:', imageBlob.size, 'bytes');

    // Create File object (matching working example)
    const file = new File([imageBlob], fileName, {
      type: 'image/jpeg',
      lastModified: new Date().getTime(),
    });

    // Create FormData - MATCHING WORKING EXAMPLE FORMAT
    const formData = new FormData();
    formData.append('images', file, fileName); // 'images' (plural) not 'image'
    formData.append('names', fileName); // Add 'names' field

    // Add 'children' field as JSON blob (empty array for now)
    const children: any[] = [];
    formData.append('children', new Blob([JSON.stringify(children)], { type: 'application/json' }));

    // Prepare request - MATCHING WORKING EXAMPLE HEADERS
    // Use cloudToken (JWE) for cloud API, not local authToken (RS256 JWT)
    const cloudUrl = `https://v1.cloud.flexiblevision.com/api/capture/annotations/upload/${projectId}`;

    // IMPORTANT: DO NOT set Content-Type for FormData!
    // The browser will automatically set it with the correct boundary:
    // "multipart/form-data; boundary=----WebKitFormBoundary..."
    const headers: HeadersInit = {
      'Accept': '*', // Use '*' not '*/*' (matching working example)
      'Authorization': `Bearer ${this.cloudToken}`, // Use JWE token for cloud
    };

    // Decode the JWT token to see payload (for debugging)
    let tokenPayload: any = null;
    try {
      const tokenParts = this.cloudToken.split('.');
      if (tokenParts.length >= 2) {
        tokenPayload = JSON.parse(atob(tokenParts[1]));
      }
    } catch (e) {
      console.log('[API] ⚠️  Could not decode token (might be JWE)');
    }

    // Log complete request details
    console.log('[API] ========== COMPLETE REQUEST DETAILS ==========');
    console.log('[API] 🌐 SOCKET HOST:', socketHost);
    console.log('[API] 📍 METHOD:', 'POST');
    console.log('[API] 📍 URL:', cloudUrl);
    console.log('[API] 📋 HEADERS (before fetch):', JSON.stringify(headers, null, 2));
    console.log('[API] ℹ️  NOTE: Content-Type will be auto-set by browser with boundary');
    console.log('[API] 🔑 AUTHORIZATION TOKEN (full):', this.cloudToken);
    console.log('[API] 🔑 TOKEN LENGTH:', this.cloudToken.length, 'chars');
    console.log('[API] 🔑 TOKEN PREVIEW (first 100 chars):', this.cloudToken.substring(0, 100) + '...');
    console.log('[API] 🔑 TOKEN PREVIEW (last 100 chars):', '...' + this.cloudToken.substring(this.cloudToken.length - 100));
    if (tokenPayload) {
      console.log('[API] 🔓 DECODED TOKEN PAYLOAD:', JSON.stringify(tokenPayload, null, 2));
      console.log('[API] 👤 TOKEN SUB (user):', tokenPayload.sub);
      console.log('[API] 🎯 TOKEN AUD (audience):', tokenPayload.aud);
      console.log('[API] ⏰ TOKEN EXP (expiry):', new Date(tokenPayload.exp * 1000).toISOString());
      console.log('[API] ⏰ TOKEN EXPIRED?:', tokenPayload.exp * 1000 < Date.now());
    }
    console.log('[API] 📦 BODY TYPE:', 'multipart/form-data (FormData)');
    console.log('[API] 📦 FORM FIELDS:');
    console.log('[API]   - images:', fileName, '(', file.size, 'bytes)');
    console.log('[API]   - names:', fileName);
    console.log('[API]   - children:', JSON.stringify(children));
    console.log('[API] ==================================================');

    const response = await fetch(cloudUrl, {
      method: 'POST',
      headers,
      body: formData,
    });

    console.log('[API] ========== RESPONSE ==========');
    console.log('[API] Status:', response.status, response.statusText);
    console.log('[API] Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Error response body:', errorText);
      console.log('[API] ====================================');
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('[API] Upload successful:', result);
    return result;
  }
}

// Singleton instance
let apiInstance: VisionLoopAPI | null = null;

export const getAPIClient = (authToken?: string): VisionLoopAPI => {
  if (!apiInstance) {
    // Try to get token from localStorage first, then parameter, then empty string
    let token = '';
    if (typeof window !== 'undefined') {
      token = localStorage.getItem('authToken') || '';
    }
    token = authToken || token;
    apiInstance = new VisionLoopAPI(token);
  } else if (authToken) {
    // If instance exists but new token provided, update it
    apiInstance.setAuthToken(authToken);
  }
  return apiInstance;
};

export const setAuthToken = (token: string) => {
  // Store token in localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('authToken', token);
  }
  // Update API instance if it exists
  if (apiInstance) {
    apiInstance.setAuthToken(token);
  }
};

export const clearAuthToken = () => {
  // Clear token from localStorage
  if (typeof window !== 'undefined') {
    localStorage.removeItem('authToken');
  }
  // Clear token from API instance if it exists
  if (apiInstance) {
    apiInstance.setAuthToken('');
  }
};

export const getStoredAuthToken = (): string => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('authToken') || '';
  }
  return '';
};
