# Upload Debug Guide

## Current Issue
- Upload returns 404 from backend
- Backend responds with null values in response
- Project ID being used: "DYH"
- Target URL: `https://v1.cloud.flexiblevision.com/api/capture/annotations/upload/DYH`

## Steps to Debug

### 1. Check Terminal Logs
Look in your terminal where `npm run dev` is running for lines starting with:
```
[Upload Proxy] Forwarding upload to backend for project: DYH
[Upload Proxy] FormData entries: ...
[Upload Proxy] Authorization header present: true
[Upload Proxy] Target URL: https://v1.cloud.flexiblevision.com/api/capture/annotations/upload/DYH
[Upload Proxy] Backend response status: 404 Not Found
[Upload Proxy] Backend response text: ...
```

### 2. Test Proxy Route
Open in browser: `http://localhost:6900/api/test-upload`
Should return: `{"message": "Upload proxy route is working"}`

### 3. Questions to Answer

#### A. Does project "DYH" exist?
- Login to `https://v1.cloud.flexiblevision.com`
- Check if project with ID "DYH" exists
- If not, what is the correct project ID?

#### B. What's the correct upload endpoint?
From your Python example, verify:
- URL format: `https://v1.cloud.flexiblevision.com/api/capture/annotations/upload/{project_id}`
- Is this correct?
- Does it require any query parameters?

#### C. What FormData field name?
Currently using: `formData.append('image', imageBlob, fileName)`
- Is 'image' the correct field name?
- Or should it be 'file', 'photo', 'upload', etc?

#### D. What does the backend expect?
Check your cloud API documentation:
- Required headers?
- Required FormData fields?
- Expected file format?

### 4. Check Current Batch Data
In browser console, check what model is being used:
```javascript
// The logs should show:
[Batch Upload] Using project ID (model): DYH
[Batch Upload] Current batch data: {model: "DYH", version: "...", id: "..."}
```

### 5. Backend Error Analysis
The response shows:
```json
{
  "title": "<built-in method title of str object at 0x7df844696710>"
}
```
This indicates a Python backend error - likely the project doesn't exist or the endpoint is wrong.

## Next Steps

Please provide:
1. **Server terminal logs** (from where npm run dev is running)
2. **Correct project ID** (if "DYH" is wrong)
3. **Valid endpoint URL** (confirm the upload endpoint URL)
4. **FormData field name** (what the backend expects)

## Quick Test

Try this in browser console to test the proxy:
```javascript
fetch('/api/test-upload', {method: 'POST', body: new FormData()})
  .then(r => r.json())
  .then(console.log)
```
