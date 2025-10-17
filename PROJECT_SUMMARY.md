# Vision Loop Frontend - Project Summary

## Overview

A production-ready Next.js 14 application for real-time industrial inspection image review and tagging, built according to your specifications with **port 6900** configured throughout.

## What Has Been Built

### Core Features Implemented ✅

1. **Real-time WebSocket Integration**
   - Socket.io client connecting to port 5000
   - Automatic reconnection with exponential backoff
   - Handles "responseMessage" events
   - Connection status indicators

2. **34 ROI Image Display**
   - Camera mapping for all 34 boxes (CAM1-CAM10)
   - Live grid updates
   - Color-coded status borders (green/red/gray)
   - Placeholder for missing images

3. **Batch Queue System (FIFO, Max 5)**
   - Buffers incoming batches even when paused
   - Removes oldest when 6th arrives
   - Maintains last 5 batches in memory

4. **Pause/Resume Functionality**
   - Pause button stops UI updates (not socket)
   - Socket continues receiving and buffering
   - Batch carousel enables when paused
   - Resume jumps to newest batch

5. **Multi-Batch Image Selection**
   - Select images across any of the 5 batches
   - Selection state persists during navigation
   - Counter shows total selected
   - Works in both paused and live modes

6. **Image Review Modal**
   - Large view for detailed inspection
   - Carousel through ONLY selected images
   - Per-image tag assignment
   - Remove from selection option
   - "Add This Image" button
   - "Add All Remaining" batch button
   - Keyboard navigation (←/→/Esc)

7. **Tag System**
   - 7 default tags with color gradients
   - Fetches from API: `GET /api/tags?model=X&version=Y`
   - Single/Multi-tag mode toggle
   - Visual feedback on selection

8. **Add to Project API**
   - Posts to: `POST /api/project/add`
   - Bearer token authentication
   - Tag-prefixed image naming: `{tag}_{originalName}`
   - Success/error notifications

9. **Dark Theme UI**
   - Glassmorphism effects
   - Professional inspection system aesthetic
   - Responsive grid layout
   - Toast notifications

10. **Docker Deployment**
    - Multi-stage Dockerfile
    - Docker Compose orchestration
    - Health checks
    - Port 6900 exposed
    - Non-root user security

## Project Structure

```
Visionloop/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main application page
│   │   ├── layout.tsx            # Root layout
│   │   └── globals.css           # Global styles + animations
│   ├── components/
│   │   ├── Header.tsx            # Pause/Resume + Status
│   │   ├── ImageCard.tsx         # Individual ROI with selection
│   │   ├── ImageGrid.tsx         # 34-image grid display
│   │   ├── BatchCarousel.tsx     # 5-batch navigation
│   │   ├── Sidebar.tsx           # Tags + Metadata + Actions
│   │   ├── ImageReviewModal.tsx  # Large view + Tag + Submit
│   │   ├── Notification.tsx      # Toast messages
│   │   └── Footer.tsx            # System status bar
│   ├── contexts/
│   │   └── AppContext.tsx        # Global state with reducer
│   ├── hooks/
│   │   ├── useWebSocket.ts       # Socket.io connection
│   │   └── useNotification.ts    # Toast notifications
│   ├── lib/
│   │   ├── api.ts                # API client (tags, add to project)
│   │   ├── socket.ts             # Socket.io setup
│   │   ├── batchProcessor.ts     # Process socket data → batches
│   │   ├── imageNaming.ts        # Generate tag-prefixed names
│   │   └── constants.ts          # Camera map, tags, config
│   └── types/
│       └── index.ts              # All TypeScript interfaces
├── public/                       # Static assets (empty for now)
├── Dockerfile                    # Production Docker image
├── docker-compose.yml            # Container orchestration
├── .dockerignore                 # Docker build exclusions
├── .env.example                  # Environment template
├── .env.local                    # Local development config
├── .gitignore                    # Git exclusions
├── package.json                  # Dependencies (port 6900)
├── tsconfig.json                 # TypeScript configuration
├── tailwind.config.ts            # Tailwind CSS config
├── postcss.config.js             # PostCSS setup
├── next.config.js                # Next.js config (standalone)
├── README.md                     # Full documentation
├── QUICKSTART.md                 # Quick setup guide
├── DEPLOYMENT.md                 # Deployment checklist
└── PROJECT_SUMMARY.md            # This file
```

## Technical Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Next.js | 14.2.0+ |
| Language | TypeScript | 5.0+ |
| Runtime | Node.js | 18+ |
| Styling | Tailwind CSS | 3.4.0+ |
| Real-time | Socket.io Client | 4.7.0+ |
| State | React Context API | - |
| Container | Docker | 20.10+ |

## Configuration

### Port Configuration (Updated to 6900)

- **Development**: `npm run dev` → `http://localhost:6900`
- **Production**: `npm start` → `http://localhost:6900`
- **Docker**: Exposed on port `6900:6900`
- **package.json**: `"dev": "next dev -p 6900"`

### Environment Variables

```env
NEXT_PUBLIC_SOCKET_HOST=localhost         # Socket.io server
NEXT_PUBLIC_SOCKET_PORT=5000              # Socket.io port
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000  # API server
NEXT_PUBLIC_MODEL_NAME=DefectNet          # Model name
NEXT_PUBLIC_MODEL_VERSION=v2.1            # Model version
AUTH_TOKEN=your_auth_token_here           # API auth token
```

## Key Implementation Details

### State Management
- Uses React Context API with `useReducer`
- No localStorage/sessionStorage (in-memory only)
- Selection state uses `Map<string, SelectedImage>` for O(1) lookup
- Key format: `${batchId}_${boxNumber}`

### Batch Queue Logic
- Always receives WebSocket data (even when paused)
- Paused: Adds to queue, doesn't update visible batch
- Not paused: Adds to queue AND updates current batch
- Queue maintains FIFO order with 5-batch max

### Image Selection Flow
1. Click image → Toggle selection
2. Navigate batches → Selection persists
3. Click "Review Selected" → Open modal
4. Large view → Assign tags → Submit
5. Auto-advance to next selected image

### WebSocket Data Processing
1. Receive `responseMessage` event
2. `processSocketData()` converts to `InspectionBatch`
3. Maps 34 camera IDs to box numbers
4. Adds batch to queue (FIFO)
5. Updates UI if not paused

### API Integration
- **Tags**: `GET /api/tags?model=DefectNet&version=v2.1`
- **Submit**: `POST /api/project/add` with Bearer token
- **Image naming**: `{Tag1}_{Tag2}_{cameraId}_{timestamp}.jpg`

## Docker Deployment

```bash
# Quick Start
docker-compose up -d

# With custom env
SOCKET_HOST=192.168.1.100 docker-compose up -d

# Check logs
docker-compose logs -f

# Stop
docker-compose down
```

## Testing Checklist

### Manual Testing Steps

1. **Start Application**
   ```bash
   npm install
   npm run dev
   ```
   Navigate to `http://localhost:6900`

2. **Test Socket Connection**
   - Check header: Green dot = connected
   - Open DevTools console: Look for socket connection logs

3. **Test Pause/Resume**
   - Click PAUSE → Batch carousel appears
   - Navigate carousel → Images change
   - Click RESUME → Returns to live view

4. **Test Selection**
   - Click 5 images → Checkmarks appear
   - Navigate to different batch → Click 3 more images
   - Sidebar shows "Selection: 8"

5. **Test Review Modal**
   - Click "Review Selected Images"
   - Modal opens with large view
   - Test ← → keys for navigation
   - Select tags → Click "Add to Project"
   - Check for success notification

6. **Test Tag Modes**
   - Toggle "Multi-Tag Mode"
   - Single mode: Only one tag selectable
   - Multi mode: Multiple tags selectable

## Known Limitations & Assumptions

### Assumptions Made (Need Confirmation)

1. **Image Data Format**: Assuming Base64 in `results[cameraId].image`
2. **Original Filename**: Generated as `{cameraId}_{timestamp}.jpg`
3. **Tag API Response**: Assuming `{ tags: string[] }`
4. **Authentication**: Static token from environment variable

### Edge Cases Handled

- ✅ Missing images (shows placeholder)
- ✅ Socket disconnection (shows status + reconnects)
- ✅ Empty batch queue (shows waiting message)
- ✅ API errors (shows error notification)
- ✅ Image load failures (graceful fallback)
- ✅ Keyboard shortcuts (prevents conflicts)

## Next Steps (Optional Enhancements)

### Recommended Additions

1. **Image Zoom/Pan** in review modal
2. **Camera filter dropdown** (filter by specific camera)
3. **Batch export** (download all selected images)
4. **Statistics dashboard** (pass/fail rates over time)
5. **User preferences** (grid size, theme customization)
6. **Mock data mode** for testing without backend
7. **Internationalization** (i18n support)
8. **Accessibility improvements** (ARIA labels, screen reader support)

### Performance Optimizations

1. **Virtual scrolling** for large image grids
2. **Image lazy loading** with Intersection Observer
3. **WebSocket message throttling**
4. **Progressive image loading** (low-res → high-res)
5. **Service Worker** for offline capability

## Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Complete documentation (50+ pages) |
| `QUICKSTART.md` | Fast setup guide (5 minutes) |
| `DEPLOYMENT.md` | Production deployment checklist |
| `PROJECT_SUMMARY.md` | This file - overview |

## Getting Started

### Fastest Path to Running

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env.local
# Edit .env.local with your socket/API settings

# 3. Run
npm run dev

# 4. Open browser
# http://localhost:6900
```

### Production Deployment

```bash
# 1. Configure .env file
# 2. Run Docker Compose
docker-compose up -d

# Access at http://your-server:6900
```

## Support

### Files to Reference

- **Setup Issues**: See `QUICKSTART.md`
- **Deployment**: See `DEPLOYMENT.md`
- **API Integration**: See `README.md` → API Endpoints section
- **Configuration**: See `README.md` → Configuration section
- **Troubleshooting**: See `DEPLOYMENT.md` → Troubleshooting section

### Common Questions

**Q: How do I change the port?**
A: Update `package.json` (dev script), `docker-compose.yml` (ports), and `Dockerfile` (EXPOSE)

**Q: Where are selections stored?**
A: In-memory only via React Context. Cleared on page refresh.

**Q: Can I select images from different batches?**
A: Yes! That's the main feature. Selection state persists across batch navigation.

**Q: What happens when I pause?**
A: Socket stays connected, batches buffer in queue, UI shows carousel for navigation.

**Q: How do I test without a backend?**
A: Create mock data in `useWebSocket.ts` or use a Socket.io test server.

## Credits

Built with:
- Next.js by Vercel
- Socket.io by Socket.io
- Tailwind CSS by Tailwind Labs
- TypeScript by Microsoft

---

**Status**: ✅ Complete and ready for deployment

**Port**: 6900 (as requested)

**Last Updated**: 2025-10-15

For questions or issues, refer to the comprehensive README.md file.
