/**
 * Local File Server for Visionloop Collection Downloads
 *
 * This lightweight server handles saving images to the local filesystem.
 * Run with: npm run file-server
 *
 * Endpoints:
 * - POST /api/save-images - Save images to Documents/Visionloop/{sessionFolder}/{tag}/
 * - POST /api/open-folder - Open a folder in Windows Explorer
 * - GET /api/health - Health check
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

const PORT = 3001;
const DOCUMENTS_PATH = path.join(os.homedir(), 'Documents', 'Visionloop');

// Ensure base directory exists
if (!fs.existsSync(DOCUMENTS_PATH)) {
  fs.mkdirSync(DOCUMENTS_PATH, { recursive: true });
  console.log(`Created base directory: ${DOCUMENTS_PATH}`);
}

// CORS headers for local development
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Parse JSON body from request
const parseBody = (req) => {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
};

// Convert base64 to buffer
const base64ToBuffer = (base64Data) => {
  // Remove data URL prefix if present
  const base64String = base64Data.includes(',')
    ? base64Data.split(',')[1]
    : base64Data;
  return Buffer.from(base64String, 'base64');
};

// Generate session folder name
const getSessionFolder = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}_${hours}${minutes}${seconds}`;
};

// Sanitize folder/file names
const sanitizeName = (name) => {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim() || 'unknown';
};

// Handle save images request
const handleSaveImages = async (req, res) => {
  try {
    const data = await parseBody(req);
    const { images, sessionFolder: customSessionFolder } = data;

    if (!images || !Array.isArray(images) || images.length === 0) {
      res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No images provided' }));
      return;
    }

    const sessionFolder = customSessionFolder || getSessionFolder();
    const sessionPath = path.join(DOCUMENTS_PATH, sessionFolder);

    // Create session folder
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [],
      sessionPath,
      savedFiles: [],
    };

    // Process each image
    for (const image of images) {
      try {
        const { tag, filename, base64, cameraId, timestamp, result } = image;

        // Create tag subfolder
        const tagFolder = sanitizeName(tag || 'untagged');
        const tagPath = path.join(sessionPath, tagFolder);
        if (!fs.existsSync(tagPath)) {
          fs.mkdirSync(tagPath, { recursive: true });
        }

        // Generate filename: {tag}_{cameraId}_{timestamp}.jpg
        const safeFilename = filename || `${tagFolder}_${sanitizeName(cameraId || 'unknown')}_${timestamp || Date.now()}.jpg`;
        const filePath = path.join(tagPath, safeFilename);

        // Convert and save
        const buffer = base64ToBuffer(base64);
        fs.writeFileSync(filePath, buffer);

        results.success++;
        results.savedFiles.push({
          tag: tagFolder,
          filename: safeFilename,
          path: filePath,
        });
      } catch (err) {
        results.failed++;
        results.errors.push(err.message);
      }
    }

    // Create manifest file with metadata
    const manifest = {
      created: new Date().toISOString(),
      totalImages: images.length,
      successful: results.success,
      failed: results.failed,
      tags: [...new Set(results.savedFiles.map(f => f.tag))],
    };
    fs.writeFileSync(
      path.join(sessionPath, '_manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      message: `Saved ${results.success} of ${images.length} images`,
      sessionPath,
      results,
    }));

  } catch (err) {
    console.error('Save error:', err);
    res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
};

// Handle open folder request
const handleOpenFolder = async (req, res) => {
  try {
    const data = await parseBody(req);
    const { folderPath } = data;

    const targetPath = folderPath || DOCUMENTS_PATH;

    if (!fs.existsSync(targetPath)) {
      res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Folder not found' }));
      return;
    }

    // Open in Windows Explorer
    const command = process.platform === 'win32'
      ? `explorer "${targetPath}"`
      : process.platform === 'darwin'
        ? `open "${targetPath}"`
        : `xdg-open "${targetPath}"`;

    exec(command, (err) => {
      if (err) {
        console.error('Failed to open folder:', err);
      }
    });

    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, path: targetPath }));

  } catch (err) {
    res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
};

// Health check
const handleHealth = (req, res) => {
  res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    documentsPath: DOCUMENTS_PATH,
    platform: process.platform,
  }));
};

// Main request handler
const server = http.createServer(async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  const url = req.url;

  try {
    if (url === '/api/save-images' && req.method === 'POST') {
      await handleSaveImages(req, res);
    } else if (url === '/api/open-folder' && req.method === 'POST') {
      await handleOpenFolder(req, res);
    } else if (url === '/api/health' && req.method === 'GET') {
      handleHealth(req, res);
    } else {
      res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  } catch (err) {
    console.error('Server error:', err);
    res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║         Visionloop Local File Server                       ║
╠════════════════════════════════════════════════════════════╣
║  Server running on: http://localhost:${PORT}                  ║
║  Save path: ${DOCUMENTS_PATH.padEnd(40)}║
║                                                            ║
║  Endpoints:                                                ║
║    POST /api/save-images  - Save images to disk            ║
║    POST /api/open-folder  - Open folder in Explorer        ║
║    GET  /api/health       - Health check                   ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down file server...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});
