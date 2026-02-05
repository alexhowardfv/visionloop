# Visionloop

<div align="center">

**AI-Powered Vision Loop Training Platform**

A real-time industrial inspection system for capturing, annotating, and uploading training data to improve computer vision models.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.7-010101?logo=socket.io)](https://socket.io/)

</div>

---

## Overview

Visionloop is a specialized front-end application designed for quality control teams to review, annotate, and submit inspection images to train AI models. It connects to industrial cameras via WebSocket, displays real-time inspection results, and enables operators to add manual annotations that are uploaded to the cloud for model retraining.

### Key Capabilities

- **Real-time Streaming**: Live display of 34 ROI (Region of Interest) images from industrial cameras
- **Manual Annotation**: Draw bounding boxes directly on images to mark defects
- **Cloud Upload**: Submit annotated images to FlexibleVision cloud API for model training
- **Batch Management**: Queue and review the last 5 inspection batches
- **Multi-Image Selection**: Select images across multiple batches for bulk operations
- **Dynamic Tag System**: Fetch category labels from the model's category index

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VISIONLOOP FRONTEND                            │
│                            (Next.js 14 + TypeScript)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Header    │    │  ImageGrid  │    │   Sidebar   │    │   Footer    │  │
│  │  (Controls) │    │  (34 ROIs)  │    │ (Selections)│    │  (Status)   │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        ImageReviewModal                               │  │
│  │  ┌─────────────────────┐  ┌────────────────────────────────────────┐ │  │
│  │  │   Image Display     │  │  AnnotationLayer                       │ │  │
│  │  │   + Bounding Boxes  │  │  - Draw new annotations                │ │  │
│  │  │   + Zoom/Pan        │  │  - Select/Delete annotations           │ │  │
│  │  └─────────────────────┘  └────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐    │
│  │   DataAnalytics    │  │ CollectionManager  │  │  RandomSampling    │    │
│  │  (Charts/Stats)    │  │ (Image Library)    │  │  (Auto-select)     │    │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                              State Management                               │
│                          (React Context + Reducer)                          │
└─────────────────────────────────────────────────────────────────────────────┘
                │                    │                     │
                ▼                    ▼                     ▼
┌───────────────────────┐ ┌─────────────────────┐ ┌─────────────────────────┐
│   WebSocket Server    │ │   Category Index    │ │  FlexibleVision Cloud   │
│   (Socket.io :5000)   │ │   Service (:5001)   │ │  API (v1.cloud.*)       │
│                       │ │                     │ │                         │
│  - responseMessage    │ │  - /category_index  │ │  - /verify_account      │
│  - Real-time batches  │ │  - Model tags       │ │  - /capture/annotations │
└───────────────────────┘ └─────────────────────┘ └─────────────────────────┘
```

---

## Features

### Real-time Inspection Display

The main grid displays 34 ROI images from industrial cameras, updating in real-time as batches arrive via WebSocket:

- **PASS/FAIL indicators** with color-coded borders
- **Camera ID labels** for each ROI position
- **Batch navigation carousel** for reviewing previous inspections
- **Pause/Resume** controls for detailed review

### Manual Annotation System

Draw bounding box annotations directly on images:

1. Open the Review Modal by clicking "Review Selected Images"
2. Click the **Draw Annotations** toggle
3. Select a tag from the available categories
4. Click and drag on the image to draw a bounding box
5. The annotation is automatically associated with the selected tag

Annotations are rendered with:
- Color-coded boxes matching tag colors
- Resize handles for adjustment
- Delete button on hover
- Coordinate normalization (0-1 range) for any image size

### Cloud Upload Integration

Upload images with annotations to the FlexibleVision cloud:

1. **Authentication**: Login via secure combo code (PIN pad)
2. **Token Management**: JWT tokens with ACL-based project access
3. **Project ID Extraction**: Automatically extracted from token's ACL claims
4. **FormData Upload**: Images sent as multipart/form-data with annotation metadata

The upload format matches the cloud API specification:
```json
{
  "images": "<File>",
  "names": "filename.jpg",
  "children": "[{\"index\":0,\"title\":\"defect\",\"tool\":\"tagBox\",\"shape\":{...}}]"
}
```

### Data Analytics

Track inspection statistics with the built-in analytics panel:

- Pass/Fail ratios over time
- Defect category distribution
- Batch throughput metrics
- Visual charts and graphs

### Collection Management

Save images to local collections for later review:

- Store images with full metadata
- Organize by category or date
- Export collections for offline analysis

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | Next.js 14 (App Router) | Server-side rendering, API routes |
| **Language** | TypeScript 5.0 (strict) | Type safety, intellisense |
| **Styling** | Tailwind CSS 3.4 | Utility-first styling, dark theme |
| **Real-time** | Socket.io Client 4.7 | WebSocket communication |
| **State** | React Context + useReducer | Global state management |
| **Auth** | JWT/JWE tokens | Secure API authentication |

---

## Getting Started

### Prerequisites

- **Node.js 18+** for local development
- **Docker** (optional) for containerized deployment
- Access to:
  - WebSocket server (port 5000)
  - Category index service (port 5001)
  - FlexibleVision cloud API

### Installation

```bash
# Clone the repository
git clone https://github.com/alexhowardfv/visionloop.git
cd visionloop

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
```

### Configuration

Edit `.env.local`:

```env
# Socket.io connection
NEXT_PUBLIC_SOCKET_HOST=localhost
NEXT_PUBLIC_SOCKET_PORT=5000

# API endpoints
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_CATEGORY_INDEX_URL=http://localhost:5001

# Model configuration
NEXT_PUBLIC_MODEL_NAME=YourModel
NEXT_PUBLIC_MODEL_VERSION=v1.0
```

### Development

```bash
# Start development server
npm run dev

# With auto-restart on port conflict
npm run dev:restart
```

Open [http://localhost:3080](http://localhost:3080)

### Production Build

```bash
npm run build
npm start
```

### Docker Deployment

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

---

## Project Structure

```
visionloop/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/                      # API route handlers
│   │   │   ├── auth/verify/          # Auth proxy to avoid CORS
│   │   │   └── upload/[projectId]/   # Upload proxy to cloud API
│   │   ├── page.tsx                  # Main application page
│   │   ├── layout.tsx                # Root layout with providers
│   │   └── globals.css               # Global styles & theme
│   │
│   ├── components/                   # React components
│   │   ├── AnnotationLayer.tsx       # Manual bounding box drawing
│   │   ├── BatchCarousel.tsx         # Batch navigation
│   │   ├── CollectionManager.tsx     # Image collections
│   │   ├── DataAnalytics.tsx         # Statistics dashboard
│   │   ├── DataInspector.tsx         # Debug data viewer
│   │   ├── Footer.tsx                # Connection status
│   │   ├── Header.tsx                # Controls & navigation
│   │   ├── ImageCard.tsx             # Individual ROI display
│   │   ├── ImageGrid.tsx             # 34-image grid layout
│   │   ├── ImageReviewModal.tsx      # Large-view image review
│   │   ├── ImageWithBoundingBoxes.tsx # Detection overlay
│   │   ├── LoginPinpad.tsx           # Secure combo entry
│   │   ├── Notification.tsx          # Toast notifications
│   │   ├── RandomSamplingCard.tsx    # Random image selection
│   │   ├── SettingsModal.tsx         # Configuration UI
│   │   ├── Sidebar.tsx               # Selection panel
│   │   └── Tooltip.tsx               # Hover tooltips
│   │
│   ├── contexts/                     # React Context providers
│   │   ├── AppContext.tsx            # Main app state
│   │   └── AuthContext.tsx           # Authentication state
│   │
│   ├── lib/                          # Utility functions
│   │   ├── api.ts                    # VisionLoopAPI class
│   │   ├── batchProcessor.ts         # Batch queue management
│   │   ├── collectionStore.ts        # IndexedDB storage
│   │   ├── constants.ts              # App constants
│   │   ├── imageNaming.ts            # File naming logic
│   │   └── socket.ts                 # Socket.io client
│   │
│   └── types/                        # TypeScript definitions
│       └── index.ts                  # All interfaces
│
├── scripts/                          # Development scripts
│   ├── dev.bat                       # Windows dev launcher
│   └── kill-port.js                  # Port cleanup utility
│
├── public/                           # Static assets
├── Dockerfile                        # Container build
├── docker-compose.yml                # Container orchestration
├── tailwind.config.ts                # Tailwind theme
├── tsconfig.json                     # TypeScript config
└── package.json                      # Dependencies
```

---

## API Reference

### WebSocket Events

**Event: `responseMessage`**

Received when a new inspection batch completes:

```typescript
interface BatchData {
  id: string;
  timestamp: number;
  overall_pass_fail: 'PASS' | 'FAIL' | 'UNKNOWN';
  model: string;
  version: string;
  project_id?: string;
  results: {
    [cameraId: string]: {
      result: 'PASS' | 'FAIL';
      reason: string;
      image: string; // Base64 encoded
      detections?: Detection[];
    }
  }
}
```

### REST Endpoints

**Category Index** (`GET /category_index/{model}/{version}`)

Returns tag names and colors for the model:

```json
{
  "1": { "id": 1, "name": "defect_#ff0000_tagBox" },
  "2": { "id": 2, "name": "scratch_#00ff00_tagBox" }
}
```

**Auth Verify** (`POST /verify_account`)

Authenticates user and returns JWT tokens:

```json
{
  "access_token": { "token": "eyJ..." },
  "user_info": {
    "logged_in_as": {
      "user_id": "uuid",
      "email": "user@example.com"
    }
  }
}
```

**Image Upload** (`POST /api/capture/annotations/upload/{projectId}`)

Uploads images with annotations to cloud storage.

---

## UI Components

### Image Review Modal

The modal provides detailed image inspection:

| Control | Function |
|---------|----------|
| **Zoom +/-** | Scale image 0.5x to 5x |
| **Reset** | Return to 100% zoom |
| **Fit** | Auto-fit image to window height |
| **Draw Annotations** | Toggle annotation mode |
| **Tag Selector** | Choose annotation category |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` | Previous image |
| `→` | Next image |
| `Esc` | Close modal |
| `Delete` | Remove selected annotation |

---

## Configuration Options

### Settings Modal

Runtime-configurable options:

- **Socket Host**: WebSocket server hostname
- **Auto-pause**: Pause stream when selecting images
- **Show Timestamps**: Display batch timestamps
- **Collection Size**: Max stored images

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_SOCKET_HOST` | WebSocket server | localhost |
| `NEXT_PUBLIC_SOCKET_PORT` | WebSocket port | 5000 |
| `NEXT_PUBLIC_API_BASE_URL` | REST API base | http://localhost:8000 |
| `NEXT_PUBLIC_CATEGORY_INDEX_URL` | Category service | http://localhost:5001 |

---

## Development

### Code Style

- **TypeScript strict mode** enforced
- **Functional components** with hooks
- **Tailwind utility classes** for styling
- **Absolute imports** via `@/` alias

### State Management

Application state is managed via React Context with useReducer:

```typescript
// Key state slices
interface AppState {
  isPaused: boolean;
  batchQueue: ProcessedBatch[];
  currentBatch: ProcessedBatch | null;
  selectedImages: Map<string, SelectedImage>;
  imageAnnotations: Map<string, ManualAnnotation[]>;
  selectedTags: string[];
  availableTags: string[];
  tagColors: Record<string, string>;
}
```

### Adding New Features

1. Define types in `src/types/index.ts`
2. Add state/actions to `src/contexts/AppContext.tsx`
3. Create component in `src/components/`
4. Add API methods to `src/lib/api.ts` if needed

---

## Troubleshooting

### WebSocket Connection Failed

```bash
# Verify server is running
curl http://{SOCKET_HOST}:{SOCKET_PORT}

# Check browser console for CORS errors
```

### Upload Returns 401 Unauthorized

1. Re-authenticate via the login pinpad
2. Check token expiration in console logs
3. Verify project ID exists in token ACL

### Annotations Not Saving

1. Ensure a tag is selected before drawing
2. Check that tags are loaded from category index
3. Verify upload proxy is receiving FormData

### Port Already in Use

```bash
# Windows
netstat -ano | findstr :3080
taskkill /PID <pid> /F

# Or use the restart script
npm run dev:restart
```

---

## Browser Support

| Browser | Minimum Version |
|---------|-----------------|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 14+ |
| Edge | 90+ |

---

## License

Proprietary - All rights reserved by FlexibleVision

---

## Contributing

This is an internal tool. For feature requests or bug reports, contact the development team.

---

<div align="center">

**Built with Next.js and TypeScript**

*Real-time inspection powered by Socket.io*

</div>
