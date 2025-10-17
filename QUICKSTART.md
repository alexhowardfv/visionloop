# Vision Loop - Quick Start Guide

Get your Vision Loop frontend up and running in minutes!

## Quick Setup (Development)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local

# 3. Edit .env.local with your settings
# NEXT_PUBLIC_SOCKET_HOST=localhost
# NEXT_PUBLIC_SOCKET_PORT=5000
# NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# 4. Run development server
npm run dev

# 5. Open browser
# Navigate to http://localhost:6900
```

## Quick Deploy (Docker)

```bash
# 1. Create .env file
cat > .env << EOF
SOCKET_HOST=your-socket-server
SOCKET_PORT=5000
API_BASE_URL=http://your-api-server:8000
MODEL_NAME=DefectNet
MODEL_VERSION=v2.1
AUTH_TOKEN=your_token_here
EOF

# 2. Start containers
docker-compose up -d

# 3. Check status
docker-compose ps

# 4. View logs
docker-compose logs -f

# 5. Access app at http://localhost:6900
```

## Test Mode (Mock Data)

If you don't have a Socket.io server yet, you can test the UI:

1. Modify `src/hooks/useWebSocket.ts` to use mock data
2. Add a timer that sends fake inspection data every 2 seconds
3. Use the example payload structure from README.md

## First Time User Flow

1. **Connect**: App auto-connects to Socket.io server
2. **Watch**: Images appear in real-time (34 ROI grid)
3. **Pause**: Click PAUSE button to freeze stream
4. **Select**: Click images to select them (across batches)
5. **Review**: Click "Review Selected Images"
6. **Tag**: Select tag(s) for each image
7. **Submit**: Click "Add to Project" to save

## Common Issues

### Can't connect to Socket.io?
- Check `NEXT_PUBLIC_SOCKET_HOST` and `SOCKET_PORT`
- Verify server is running: `curl http://host:5000`
- Check browser console for errors

### No images showing?
- Ensure Socket.io server is sending "responseMessage" events
- Check data structure matches spec in README
- Verify image data is Base64 encoded

### Port 6900 already in use?
```bash
# Change port in package.json
"dev": "next dev -p 7000"

# Or in docker-compose.yml
ports:
  - "7000:6900"
```

## Key Features to Try

1. **Batch Queue**: Pause → See last 5 batches → Navigate with carousel
2. **Multi-Selection**: Select images from different batches
3. **Review Modal**: Large view with keyboard navigation (←/→/Esc)
4. **Multi-Tag Mode**: Toggle in sidebar to select multiple tags
5. **Batch Add**: "Add All Remaining" in review modal

## Need Help?

1. Check full README.md for detailed documentation
2. Review API endpoints specification
3. Inspect browser DevTools console for errors
4. Check Docker logs: `docker-compose logs`

---

Ready to inspect! 🚀
