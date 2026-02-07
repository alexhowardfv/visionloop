# Visionloop

<div align="center">

**AI-Powered Vision Loop Training Platform**

A real-time industrial inspection system for capturing, reviewing, annotating, and uploading training data to improve computer vision models in manufacturing quality control workflows.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.7-010101?logo=socket.io)](https://socket.io/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com/)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [State Management](#state-management)
- [Data Pipeline](#data-pipeline)
- [Component Reference](#component-reference)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [UI/UX Design System](#uiux-design-system)
- [Docker Deployment](#docker-deployment)
- [Development Guide](#development-guide)
- [Troubleshooting](#troubleshooting)
- [Browser Support](#browser-support)
- [License](#license)

---

## Overview

Visionloop is a specialized front-end application designed for quality control teams operating in industrial manufacturing environments. It connects to a network of industrial cameras via WebSocket, displays real-time inspection results across 34 Regions of Interest (ROIs), and enables operators to:

- **Monitor** live inspection feeds with instant PASS/FAIL status
- **Review** captured images in a dedicated full-screen modal with zoom and pan
- **Annotate** images by drawing bounding boxes to mark defects or features
- **Classify** images with dynamic tag labels fetched from the active model's category index
- **Upload** annotated images to the FlexibleVision cloud API for model retraining
- **Collect** images into organized sets with random sampling and class balancing

The platform is purpose-built for the "vision loop" workflow — the iterative cycle of inspecting products, identifying model weaknesses, adding training data, and redeploying improved models.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              VISIONLOOP FRONTEND                             │
│                            (Next.js 14 + TypeScript)                         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Header    │    │  BatchQueue  │    │  ImageGrid  │    │   Sidebar   │  │
│  │  Controls   │    │  Carousel    │    │  (34 ROIs)  │    │  Selection  │  │
│  │  Pause/Play │    │  FLIP Anim.  │    │  PASS/FAIL  │    │  Tags/Upload│  │
│  └─────────────┘    └──────────────┘    └─────────────┘    └─────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │                         ImageReviewModal                              │   │
│  │  ┌──────────────────────┐  ┌──────────────────────────────────────┐  │   │
│  │  │   Image Display      │  │  AnnotationLayer                     │  │   │
│  │  │   + Bounding Boxes   │  │  - Draw bounding boxes               │  │   │
│  │  │   + Zoom (0.5x-5x)  │  │  - Resize handles                   │  │   │
│  │  │   + Pan / Drag       │  │  - Select / Delete annotations      │  │   │
│  │  └──────────────────────┘  └──────────────────────────────────────┘  │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────────────────┐   │
│  │  DataAnalytics  │  │  Collection     │  │  SettingsModal             │   │
│  │  Charts/Stats   │  │  Manager        │  │  Connection / Display /    │   │
│  │  Pass/Fail/ROI  │  │  Random Sample  │  │  Data / Admin              │   │
│  └─────────────────┘  └─────────────────┘  └────────────────────────────┘   │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  Contexts:  AppContext (useReducer, 33 actions)  │  AuthContext (JWT/JWE)    │
│  Hooks:     useWebSocket (Socket.io)             │  useNotification (Toast)  │
└──────────────────────────────────────────────────────────────────────────────┘
                │                     │                      │
                ▼                     ▼                      ▼
┌────────────────────────┐ ┌──────────────────────┐ ┌──────────────────────────┐
│   WebSocket Server     │ │  Category Index      │ │  FlexibleVision Cloud    │
│   (Socket.io :5000)    │ │  Service (:5001)     │ │  API (v1.cloud.*)        │
│                        │ │                      │ │                          │
│  Event:                │ │  GET /category_index │ │  POST /verify_account    │
│  - responseMessage     │ │      /{model}/{ver}  │ │  POST /capture/          │
│  - Real-time batches   │ │  Returns tag names,  │ │    annotations/upload/   │
│  - Camera ROI data     │ │  colors, tool types  │ │    {projectId}           │
└────────────────────────┘ └──────────────────────┘ └──────────────────────────┘
```

### Data Flow

1. **Industrial cameras** capture product images and send them through a processing pipeline
2. **WebSocket server** emits `responseMessage` events containing inspection results per camera
3. **Visionloop** receives individual camera messages and aggregates them into **inspection batches** using a 1-second sliding window via `batchProcessor.ts`
4. **Batches** are dispatched to the global state via `ADD_BATCH`, maintaining a FIFO queue (configurable max size, default 5)
5. **Operators** review images, select items across batches, assign classification tags, draw annotations, and upload to the cloud

---

## Features

### Real-time Inspection Display

The main grid displays **34 ROI (Region of Interest) images** from 10 industrial cameras, updating in real-time as batches arrive:

- **PASS/FAIL color coding**: Green borders for passing inspections, red for failures, gray for unknown
- **Camera ID labels**: Each ROI position maps to a specific camera (CAM1–CAM10) via a fixed layout in `constants.ts`
- **Batch carousel**: Navigate between queued batches with a horizontal card strip featuring FLIP animations for smooth transitions
- **Queue status indicators**: Newest batch is always #1; cards near eviction glow red with animated pulses
- **Overall status badge**: Aggregated PASS/FAIL indicator anchored in the carousel

### Batch Queue Management

- **Configurable queue size**: Set via Settings (default: 5 batches)
- **FIFO eviction**: Oldest batches are automatically dropped when the queue fills
- **Expiring card warnings**: The 3 oldest cards in a full queue display tiered red glow animations:
  - **Next to drop**: Strong pulse (`glow-pulse` — 2s period)
  - **Second to drop**: Medium pulse (`glow-pulse-mid` — 3s period)
  - **Third to drop**: Soft static glow (`shadow-glow-red-soft`)
- **Pause protection**: When paused, the queue grows unbounded; on resume, `TRIM_AND_RESUME` reconciles back to the max size
- **Auto-pause on review**: Opening the Image Review Modal automatically pauses the stream; closing restores the previous pause state

### Multi-Image Selection

- Click individual ROI cards to select/deselect them
- Selected images persist across batch navigation
- Blue badge on carousel cards shows how many images are selected per batch
- Selection is automatically cleaned up when batches leave the queue

### Sidebar — Three-Card Layout

The sidebar is organized into three distinct action cards:

#### Card 1: Selection
- Displays the current selection count with a blue badge
- **Review Selection** button opens the full-screen review modal
- **Clear Selection** button with confirmation styling
- Disabled states with contextual tooltips when no images are selected

#### Card 2: Classification
- Dynamic classification tags fetched from the model's category index service
- Each tag rendered as a button with its configured color
- **Multi-Tag Mode** toggle allows selecting multiple tags simultaneously
- Inline description: *"Selected tags are added to the filename when uploading"*

#### Card 3: Upload
- **Upload to Project** button sends selected images + tags to the cloud
- Tag preview pills show which classification tags will be applied
- Smart disabled state: requires both selected images AND at least one tag
- Contextual tooltip messages for each disabled condition
- Amber hint text when images are selected but no tag is chosen

### Manual Annotation System

Draw bounding box annotations directly on images in the Review Modal:

1. Open the Review Modal by selecting images and clicking "Review Selection"
2. Toggle **Draw Annotations** mode in the toolbar
3. Select a tag from the annotation tag selector
4. Click and drag on the image to draw a bounding box
5. Annotations are automatically associated with the selected tag and its color

Annotation features:
- **Color-coded boxes** matching tag colors with labels
- **Resize handles** on all 4 corners and edges for precise adjustment
- **Delete button** appears on hover for quick removal
- **Coordinate normalization**: All coordinates stored in 0–1 range, rendering correctly at any zoom level
- **Per-image storage**: Each image maintains its own independent annotation set
- **Cloud-compatible format**: Annotations match the FlexibleVision cloud API specification

### Cloud Upload Integration

Upload images with annotations to FlexibleVision cloud for model retraining:

1. **Authentication**: Login via a secure combo code (PIN pad interface)
2. **Token management**: JWT tokens obtained from `/verify_account` endpoint, with ACL-based project access
3. **Project ID extraction**: Automatically parsed from the token's ACL claims
4. **Tagged filenames**: Classification tags are prepended to the original filename (e.g., `scratch_defect_CAM3_001.jpg`)
5. **FormData upload**: Images sent as multipart/form-data with annotation metadata in the cloud's expected children format:

```json
{
  "images": "<File>",
  "names": "scratch_defect_CAM3_001.jpg",
  "children": "[{\"index\":0,\"title\":\"defect\",\"tool\":\"tagBox\",\"shape\":{\"x\":0.1,\"y\":0.2,\"width\":0.3,\"height\":0.4}}]"
}
```

### Data Analytics

Track inspection statistics with the built-in analytics panel:

- Pass/fail ratios and trends
- Defect category distribution
- Batch throughput metrics
- ROI-level performance tracking

### Collection Management

Save images to local in-memory collections for later review and export:

- Organize images by dominant tag
- **Random sampling** with configurable class balance targets
- Filter by PASS/FAIL/ALL results
- Track collection size per category
- Export and download functionality

### Settings Modal

Four configuration tabs in a compact modal:

| Tab | Controls |
|-----|----------|
| **Connection** | Socket host, port, reconnection settings |
| **Display** | Annotation toggle, image rendering options |
| **Data** | Captured message count, collection size, batch queue utilization (with visual fill bar) |
| **Admin** | Developer tools, mock data generation, feature flags |

### Authentication

- **PIN pad interface** for secure login without keyboard
- **JWT/JWE token** management with automatic project ID extraction
- **Auth state** persisted in localStorage via `AuthContext`
- **Footer indicator** showing authenticated/unauthenticated status
- **Connection status** indicator with live/disconnected dot

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | Next.js 14 (App Router) | SSR, API routes, standalone output |
| **Language** | TypeScript 5.0 (strict mode) | Type safety across the entire codebase |
| **UI** | React 18 | Functional components with hooks |
| **Styling** | Tailwind CSS 3.4 | Utility-first dark theme, glassmorphism effects |
| **Real-time** | Socket.io Client 4.7 | WebSocket with polling fallback, auto-reconnect |
| **State** | React Context + useReducer | 33-action reducer with typed dispatch |
| **Auth** | JWT/JWE tokens | Secure cloud API authentication |
| **Build** | Docker (multi-stage) | Optimized production container |
| **Font** | Inter (variable) | Clean sans-serif via `next/font` |

---

## Getting Started

### Prerequisites

- **Node.js 18+** (LTS recommended)
- **npm** (included with Node.js)
- **Docker** (optional, for containerized deployment)
- Network access to:
  - WebSocket inspection server (default: port 5000)
  - Category index service (default: port 5001)
  - FlexibleVision cloud API (for uploads)

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

Edit `.env.local` with your environment values:

```env
# Socket.io connection — where the inspection server is running
NEXT_PUBLIC_SOCKET_HOST=localhost
NEXT_PUBLIC_SOCKET_PORT=5000

# API endpoints — proxy server for auth and uploads
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# Model info — displayed in footer and used for category index lookup
NEXT_PUBLIC_MODEL_NAME=DefectNet
NEXT_PUBLIC_MODEL_VERSION=v2.1

# Server-side auth token (not exposed to browser)
AUTH_TOKEN=your_auth_token_here
```

### Development

```bash
# Start development server on port 3080
npm run dev

# If port 3080 is already in use
npm run dev:restart
```

Open [http://localhost:3080](http://localhost:3080) in your browser.

### Production Build

```bash
# Build optimized standalone output
npm run build

# Start production server
npm start
```

### Mock Data Mode

For development without a live camera feed, enable **Mock Data** from the Settings > Admin tab. This generates synthetic inspection batches with canvas-rendered placeholder images, random PASS/FAIL results, and sample bounding box detections.

---

## Project Structure

```
visionloop/
├── src/
│   ├── app/                              # Next.js App Router
│   │   ├── api/                          # Server-side API route handlers
│   │   │   ├── auth/verify/              # Auth proxy to FlexibleVision (avoids CORS)
│   │   │   └── upload/[projectId]/       # Upload proxy to cloud API
│   │   ├── page.tsx                      # Main application page (770+ lines)
│   │   ├── layout.tsx                    # Root HTML layout with font + providers
│   │   └── globals.css                   # Global styles, CSS variables, theme
│   │
│   ├── components/                       # React components (18 files)
│   │   ├── AnnotationLayer.tsx           # Canvas-based bounding box drawing
│   │   ├── BatchCarousel.tsx             # Batch queue navigation with FLIP animations
│   │   ├── CategoryCard.tsx              # Category display card
│   │   ├── CollectionManager.tsx         # Image collection management UI
│   │   ├── DataAnalytics.tsx             # Statistics and chart visualization
│   │   ├── DataInspector.tsx             # Raw data inspection/debug viewer
│   │   ├── Footer.tsx                    # Connection status, model info, auth state
│   │   ├── Header.tsx                    # Pause/resume, settings, login controls
│   │   ├── ImageCard.tsx                 # Individual ROI image with PASS/FAIL
│   │   ├── ImageGrid.tsx                 # 34-position grid layout
│   │   ├── ImageReviewModal.tsx          # Full-screen review with zoom/pan/annotate
│   │   ├── ImageWithBoundingBoxes.tsx    # Renders detection boxes on images
│   │   ├── LoginPinpad.tsx               # PIN-based combo authentication
│   │   ├── Notification.tsx              # Toast notification component
│   │   ├── RandomSamplingCard.tsx        # Random sampling configuration card
│   │   ├── SettingsModal.tsx             # 4-tab settings (Connection/Display/Data/Admin)
│   │   ├── Sidebar.tsx                   # 3-card sidebar (Selection/Classification/Upload)
│   │   └── Tooltip.tsx                   # Hover tooltip with configurable position
│   │
│   ├── contexts/                         # React Context providers
│   │   ├── AppContext.tsx                # Global state: 33 actions, FIFO batch queue
│   │   └── AuthContext.tsx               # Auth state: tokens, userId, localStorage sync
│   │
│   ├── hooks/                            # Custom React hooks
│   │   ├── useWebSocket.ts              # Socket.io connection with auto-reconnect
│   │   └── useNotification.ts           # Toast notification management
│   │
│   ├── lib/                              # Utility libraries
│   │   ├── api.ts                        # VisionLoopAPI class (auth, tags, upload)
│   │   ├── batchProcessor.ts             # Aggregates camera messages into batches
│   │   ├── collectionStore.ts            # In-memory collection with random sampling
│   │   ├── constants.ts                  # 34 ROI camera mappings, socket events
│   │   ├── downloadService.ts            # Local file server communication
│   │   ├── imageNaming.ts                # Tag-prefixed filename generation
│   │   ├── mockDataGenerator.ts          # Canvas-based mock inspection data
│   │   └── socket.ts                     # Socket.io client factory
│   │
│   └── types/                            # TypeScript definitions
│       └── index.ts                      # All interfaces and prop types
│
├── scripts/                              # Development utilities
│   ├── dev.bat                           # Windows dev launcher
│   ├── kill-port.js                      # Port 3080 cleanup utility
│   └── file-server.js                    # Local file download server
│
├── public/                               # Static assets
│   └── logo.png                          # Application logo
│
├── Dockerfile                            # Multi-stage production build
├── docker-compose.yml                    # Container orchestration
├── tailwind.config.ts                    # Custom theme, animations, colors
├── tsconfig.json                         # TypeScript strict config with @/* alias
├── postcss.config.js                     # PostCSS + Tailwind + Autoprefixer
├── next.config.js                        # Standalone output, image config
├── .env.example                          # Environment variable template
└── package.json                          # Dependencies and scripts
```

---

## State Management

Application state is managed via React Context with `useReducer`, following a Redux-like pattern.

### AppState Structure

```typescript
interface AppState {
  batchQueue: InspectionBatch[];       // FIFO queue of inspection batches
  currentBatchIndex: number;           // Active batch in the carousel
  isStreamPaused: boolean;             // Pause/resume control
  wasPausedBeforeReview: boolean;      // Restore state after review modal
  selectedImages: Map<string, SelectedImage>; // Multi-batch selection
  imageAnnotations: Map<string, ManualAnnotation[]>; // Per-image annotations
  isReviewModalOpen: boolean;          // Review modal visibility
  reviewCarouselIndex: number;         // Image index in review modal
  availableTags: string[];             // Tags from category index
  tagColors: Record<string, string>;   // Tag → hex color mapping
  selectedTags: string[];              // Active classification tags
  multiTagMode: boolean;               // Allow multiple tag selection
  // ... additional state for analytics, collections, settings
}
```

### Action Types (33 total)

Key actions include:

| Action | Description |
|--------|-------------|
| `ADD_BATCH` | Adds a new inspection batch, evicts oldest if at max |
| `SET_STREAM_PAUSED` | Toggle pause/resume |
| `TRIM_AND_RESUME` | Reconcile queue on resume after unbounded pause growth |
| `SET_REVIEW_MODAL_OPEN` | Open/close review with auto-pause/restore |
| `TOGGLE_IMAGE_SELECTION` | Select/deselect an ROI image |
| `SET_IMAGE_ANNOTATIONS` | Update annotations for a specific image |
| `TOGGLE_TAG` | Toggle a classification tag on/off |
| `SET_MULTI_TAG_MODE` | Switch between single and multi-tag selection |

### State Flow

```
User Action → dispatch(action) → reducer → new AppState → component re-render
```

State is provided at the root layout level and consumed by any component via `useApp()` hook.

---

## Data Pipeline

### Socket Message Processing

```
Camera → WebSocket Server → Socket.io Event → useWebSocket Hook
                                                      │
                                                      ▼
                                              batchProcessor.ts
                                              ┌──────────────────┐
                                              │ Accumulate camera │
                                              │ messages for 1s   │
                                              │ window            │
                                              │                   │
                                              │ Transform coords  │
                                              │ (90° rotation +   │
                                              │  vertical flip)   │
                                              │                   │
                                              │ Build ROI array   │
                                              │ with detections   │
                                              └────────┬─────────┘
                                                       │
                                                       ▼
                                              dispatch(ADD_BATCH)
                                              ┌──────────────────┐
                                              │ FIFO queue       │
                                              │ Max size check   │
                                              │ Evict oldest     │
                                              │ Clean selections │
                                              └──────────────────┘
```

### Batch Processor Details

The `batchProcessor.ts` handles two message formats:

1. **Individual camera messages**: Each camera sends its own result; the processor aggregates them using a 1000ms timeout window grouped by batch ID
2. **Legacy aggregated format**: A single message contains all camera results

For each message, the processor:
- Extracts model name, version, and project ID
- Maps camera results to the 34-position ROI grid using `constants.ts`
- Transforms bounding box coordinates (90° rotation + vertical flip to match display orientation)
- Determines overall PASS/FAIL status
- Generates a fallback batch ID if not provided by the server

---

## Component Reference

### Core Layout

| Component | File | Description |
|-----------|------|-------------|
| **Header** | `Header.tsx` | Pause/resume toggle, settings gear, login/logout button |
| **ImageGrid** | `ImageGrid.tsx` | 34-position ROI grid with camera labels and click-to-select |
| **Sidebar** | `Sidebar.tsx` | 3-card panel: Selection, Classification, Upload |
| **Footer** | `Footer.tsx` | Model name, version, last update time, FPS, auth status, connection indicator |
| **BatchCarousel** | `BatchCarousel.tsx` | Horizontal batch queue with FLIP animations, expiring glow effects, hover popovers |

### Modals

| Component | File | Description |
|-----------|------|-------------|
| **ImageReviewModal** | `ImageReviewModal.tsx` | Full-screen image review with carousel, zoom (0.5x–5x), pan, annotation toolbar |
| **SettingsModal** | `SettingsModal.tsx` | 4-tab configuration: Connection, Display, Data, Admin |
| **LoginPinpad** | `LoginPinpad.tsx` | Secure combo-code entry with visual feedback |

### Image Processing

| Component | File | Description |
|-----------|------|-------------|
| **ImageCard** | `ImageCard.tsx` | Individual ROI with PASS/FAIL border, camera label, selection checkbox |
| **ImageWithBoundingBoxes** | `ImageWithBoundingBoxes.tsx` | Overlays detection bounding boxes on images |
| **AnnotationLayer** | `AnnotationLayer.tsx` | Canvas-based manual annotation drawing with resize handles |

### Data & Collections

| Component | File | Description |
|-----------|------|-------------|
| **DataAnalytics** | `DataAnalytics.tsx` | Charts and statistics dashboard |
| **DataInspector** | `DataInspector.tsx` | Raw data debug viewer |
| **CollectionManager** | `CollectionManager.tsx` | Saved image collections with organization |
| **RandomSamplingCard** | `RandomSamplingCard.tsx` | Random sampling with class balance targets |

---

## API Reference

### WebSocket Events

**Event: `responseMessage`**

Emitted by the inspection server when a camera completes analysis:

```typescript
interface SocketInspectionData {
  id?: string;                           // Batch ID (optional, generated if missing)
  timestamp?: number;                    // Unix ms
  overall_pass_fail?: 'PASS' | 'FAIL';  // Aggregated status
  model?: string;                        // Model name
  version?: string;                      // Model version
  project_id?: string;                   // Cloud project ID
  results: {
    [cameraId: string]: {
      result: 'PASS' | 'FAIL';
      reason: string;
      image: string;                     // Base64-encoded JPEG
      detections?: {
        label: string;
        confidence: number;
        bbox: [x, y, width, height];     // Pixel coordinates
        color?: string;                  // Hex color for display
      }[];
    }
  }
}
```

### REST Endpoints

**Category Index** — `GET http://{SOCKET_HOST}:5001/category_index/{model}/{version}`

Returns the model's tag definitions:

```json
{
  "1": { "id": 1, "name": "defect_#ff0000_tagBox" },
  "2": { "id": 2, "name": "scratch_#00ff00_tagBox" },
  "3": { "id": 3, "name": "dent_#0000ff_tagBox" }
}
```

Tag name format: `{label}_{hexColor}_{toolType}`

**Auth Verify** — `POST /api/auth/verify` (proxied to cloud's `/verify_account`)

```json
// Request
{ "combo": "123456" }

// Response
{
  "access_token": { "token": "eyJ..." },
  "user_info": {
    "logged_in_as": {
      "user_id": "uuid-string",
      "email": "operator@company.com"
    }
  }
}
```

**Image Upload** — `POST /api/capture/annotations/upload/{projectId}`

Multipart FormData with fields:
- `images` — JPEG blob
- `names` — Tag-prefixed filename string
- `children` — JSON string of annotation array matching cloud format

---

## Configuration

### Runtime Settings (Settings Modal)

All runtime settings persist in `localStorage`:

| Setting | Key | Default | Description |
|---------|-----|---------|-------------|
| Socket Host | `socketHost` | `localhost` | WebSocket server hostname |
| Socket Port | `socketPort` | `5000` | WebSocket server port |
| Max Batch Queue | `maxBatchQueue` | `5` | Maximum batches retained |
| Annotations | `annotationsEnabled` | `true` | Enable annotation drawing |

### Environment Variables

| Variable | Scope | Default | Description |
|----------|-------|---------|-------------|
| `NEXT_PUBLIC_SOCKET_HOST` | Client | `localhost` | WebSocket server hostname |
| `NEXT_PUBLIC_SOCKET_PORT` | Client | `5000` | WebSocket server port |
| `NEXT_PUBLIC_API_BASE_URL` | Client | `http://localhost:8000` | REST API proxy base URL |
| `NEXT_PUBLIC_MODEL_NAME` | Client | `DefectNet` | Model name shown in footer |
| `NEXT_PUBLIC_MODEL_VERSION` | Client | `v2.1` | Model version shown in footer |
| `AUTH_TOKEN` | Server | — | Server-side auth token (not exposed to browser) |

### Camera ROI Mappings

The 34 ROI positions are statically mapped in `src/lib/constants.ts`:

| Positions | Camera |
|-----------|--------|
| 1–4 | CAM3 |
| 5–8 | CAM5 |
| 9–12 | CAM7 |
| 13–16 | CAM9 |
| 17–20 | CAM2 |
| 21–24 | CAM4 |
| 25–28 | CAM6 |
| 29–32 | CAM8 |
| 33 | CAM1 |
| 34 | CAM10 |

---

## UI/UX Design System

### Theme

Visionloop uses a dark industrial theme optimized for factory floor environments:

| Token | Value | Usage |
|-------|-------|-------|
| `primary` | `#1c1c1c` | Main background |
| `primary-lighter` | `#2a2a2a` | Card backgrounds |
| `card` | `rgba(40, 40, 40, 0.4)` | Glassmorphism panels |
| `border` | `rgba(100, 116, 139, 0.3)` | Subtle borders |
| `status-pass` | `#22c55e` | Green — passing inspections |
| `status-fail` | `#ef4444` | Red — failing inspections |
| `status-unknown` | `#64748b` | Gray — unknown/pending |

### Glassmorphism

Key panels use backdrop blur for a frosted-glass effect:
- `backdrop-blur-glass` (10px blur)
- Semi-transparent backgrounds (`bg-primary/80`)

### Custom Animations

Defined in `tailwind.config.ts`:

| Animation | Duration | Usage |
|-----------|----------|-------|
| `glow-pulse` | 2s infinite | Strongest expiring card warning |
| `glow-pulse-mid` | 3s infinite | Medium expiring card warning |
| `shadow-glow-red-soft` | Static | Soft expiring card warning |

### Toggle Switches

Custom-styled checkboxes using the `sr-only` + visual div pattern:
- Hidden `<input type="checkbox" className="sr-only" />`
- Visual track: `w-9 h-5 rounded-full` with color transition
- Sliding dot: `w-4 h-4 bg-white rounded-full` with `translate-x-4` transform

### Keyboard Shortcuts

| Key | Context | Action |
|-----|---------|--------|
| `←` / `→` | Review Modal | Navigate between selected images |
| `Escape` | Review Modal | Close the modal |
| `Delete` | Review Modal | Remove selected annotation |

---

## Docker Deployment

### Multi-Stage Dockerfile

The Dockerfile uses a 3-stage build for minimal production image size:

1. **deps** — Install production dependencies only
2. **builder** — Install all dependencies, build Next.js standalone output
3. **runner** — Alpine-based runtime with non-root user, health check

### Quick Start

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f vision-loop-frontend

# Stop
docker-compose down
```

### Docker Compose Configuration

The `docker-compose.yml` exposes port **3080** and accepts environment overrides:

```bash
# Custom configuration via environment variables
SOCKET_HOST=192.168.1.100 SOCKET_PORT=5000 docker-compose up -d
```

### Health Check

The container includes a built-in health check:
- **Interval**: 30s
- **Timeout**: 3s
- **Start period**: 5s
- **Retries**: 3

---

## Development Guide

### NPM Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `next dev -p 3080` | Start development server |
| `dev:restart` | `kill-port && next dev` | Kill stale process, then start |
| `build` | `next build` | Production build (standalone) |
| `start` | `next start -p 3080` | Start production server |
| `lint` | `next lint` | Run ESLint |
| `file-server` | `node scripts/file-server.js` | Local file download server |

### Code Style

- **TypeScript strict mode** enforced via `tsconfig.json`
- **Functional components** with hooks — no class components
- **Tailwind utility classes** for all styling — no CSS modules
- **Absolute imports** via `@/*` path alias mapped to `src/*`
- **`'use client'`** directive on all interactive components

### Adding a New Feature

1. Define TypeScript interfaces in `src/types/index.ts`
2. Add state fields and reducer actions in `src/contexts/AppContext.tsx`
3. Create the component in `src/components/`
4. Wire it into `src/app/page.tsx`
5. Add API methods to `src/lib/api.ts` if needed

### Mock Data for Testing

Enable mock data from **Settings > Admin** to test without a live socket connection. The mock generator (`src/lib/mockDataGenerator.ts`):
- Creates canvas-rendered placeholder images with random colors
- Generates random PASS/FAIL results per ROI
- Produces sample bounding box detections
- Dispatches `ADD_BATCH` directly (bypasses socket and batchProcessor)

---

## Troubleshooting

### WebSocket Connection Failed

```bash
# Verify the inspection server is running
curl http://{SOCKET_HOST}:{SOCKET_PORT}

# Check browser console for CORS errors
# Verify the socket host/port in Settings > Connection
```

### Upload Returns 401 Unauthorized

1. Re-authenticate via the login PIN pad
2. Check token expiration in browser console logs
3. Verify the project ID exists in the token's ACL claims
4. Ensure the API proxy route is correctly forwarding the Authorization header

### Annotations Not Saving

1. Ensure a classification tag is selected before drawing
2. Verify tags loaded successfully from the category index service
3. Check the upload proxy is receiving the `children` FormData field

### Port Already in Use

```bash
# Windows
netstat -ano | findstr :3080
taskkill /PID <pid> /F

# Or use the built-in restart script
npm run dev:restart
```

### Build Fails While Dev Server Running

The Next.js dev server locks `.next/trace`, preventing concurrent builds. Stop the dev server before running `npm run build`.

---

## Browser Support

| Browser | Minimum Version |
|---------|-----------------|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 14+ |
| Edge | 90+ |

Requires: ES2020 support, WebSocket API, Canvas API, CSS backdrop-filter.

---

## License

Proprietary — All rights reserved by FlexibleVision.

---

## Contributing

This is an internal tool. For feature requests or bug reports, contact the development team.

---

<div align="center">

**Built with Next.js 14, React 18, and TypeScript**

*Real-time industrial inspection powered by Socket.io*

</div>
