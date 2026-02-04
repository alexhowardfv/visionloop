# Visionloop - AI Vision Loop Training Platform
## Technical Architecture Document

**Author:** Alexander
**Date:** February 2026
**Purpose:** Part 2 - Architecture Discussion Interview

---

## Executive Summary

Visionloop is a real-time industrial inspection data collection platform that I architected and deployed to solve the critical bottleneck of ML training data acquisition in manufacturing quality control systems. The platform streams live inspection data from 34 cameras via WebSocket, enables operators to curate and tag images, and uploads annotated datasets to cloud storage for model retraining.

**Key Business Impact:**
- Reduced training data collection time from weeks to hours
- Enabled continuous model improvement through production data feedback loops
- Deployed to production environments supporting real-time inspection workflows

---

## 1. System Overview

### Problem Statement
Manufacturing AI inspection systems need continuous retraining with production data to:
- Adapt to new defect types
- Reduce false positives/negatives
- Handle product variations

**Challenge:** Getting labeled training data from production required manual screenshot capture, file management, and upload - taking hours per session.

### Solution Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           VISIONLOOP PLATFORM                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────────┐    ┌──────────────────────────────┐ │
│  │  34 Cameras │───▶│  Socket.io      │───▶│  Next.js Frontend            │ │
│  │  (ROIs)     │    │  Server :5000   │    │  Real-time Grid Display      │ │
│  └─────────────┘    └─────────────────┘    └──────────────────────────────┘ │
│                                                       │                      │
│                                                       ▼                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        STATE MANAGEMENT                                  ││
│  │  ┌──────────────┐  ┌──────────────────┐  ┌─────────────────────────┐   ││
│  │  │ AppContext   │  │ BatchProcessor   │  │ CollectionStore         │   ││
│  │  │ (UI State)   │  │ (Aggregation)    │  │ (In-Memory Collection)  │   ││
│  │  └──────────────┘  └──────────────────┘  └─────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                       │                      │
│                         ┌─────────────────────────────┼───────────────┐      │
│                         ▼                             ▼               ▼      │
│  ┌─────────────────────────┐  ┌───────────────────────┐  ┌─────────────────┐│
│  │ Cloud Upload API        │  │ Local File Server     │  │ Auth Service    ││
│  │ (Training Platform)     │  │ :3001 (Bulk Export)   │  │ (PIN + JWT)     ││
│  └─────────────────────────┘  └───────────────────────┘  └─────────────────┘│
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack & Rationale

| Layer | Technology | Why I Chose It |
|-------|------------|----------------|
| **Framework** | Next.js 14 (App Router) | SSR capability for fast initial load; API routes eliminate CORS issues |
| **Language** | TypeScript (strict) | Catch type errors at compile time; self-documenting interfaces |
| **Real-time** | Socket.io | Automatic fallback from WebSocket to polling; built-in reconnection |
| **State** | React Context + Reducer | Predictable updates; no external dependencies; easier debugging |
| **Styling** | Tailwind CSS | Rapid prototyping; consistent design system; small bundle |
| **Containerization** | Docker | Consistent deployment across factory environments |

### Key Trade-offs I Made

1. **Context vs Redux:** Chose Context for simplicity - only 2 consumers needed global state
2. **Module Store vs Context:** CollectionStore uses module pattern to persist across route changes without provider overhead
3. **Polling Fallback:** Accepted slight latency increase for reliability in factory network conditions

---

## 3. Core Architecture Components

### 3.1 Real-Time Data Pipeline

```
Camera Feed → Socket.io Server → WebSocket → BatchAggregator → UI
                                     │
                                     ▼
                              1000ms Window
                              (Group by batch_id)
                                     │
                                     ▼
                              InspectionBatch
                              (34 ROI images)
```

**Design Decision: Time-Windowed Batch Aggregation**

Individual camera messages arrive asynchronously. I implemented a 1000ms aggregation window:

```typescript
// src/lib/batchProcessor.ts
class BatchAggregator {
  private pendingMessages: Map<string, SocketInspectionData[]>;
  private timeoutIds: Map<string, NodeJS.Timeout>;

  addMessage(data: SocketInspectionData) {
    const batchId = data.batch_id || `time_${Math.floor(Date.now() / 1000)}`;

    // Start/reset 1000ms window
    this.resetTimeout(batchId, () => {
      this.buildAndDispatchBatch(batchId);
    });
  }
}
```

**Why 1000ms?** Measured P99 camera message spread was ~800ms. 1000ms captures 99.5%+ completeness while maintaining UI responsiveness.

### 3.2 State Management Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       AppContext                                 │
├─────────────────────────────────────────────────────────────────┤
│  State:                          │  Actions (Reducer):          │
│  ─────────                       │  ────────────────            │
│  • isStreamPaused: boolean       │  SET_PAUSED                  │
│  • isConnected: boolean          │  SET_CONNECTED               │
│  • currentBatch: InspectionBatch │  ADD_BATCH                   │
│  • batchQueue: InspectionBatch[] │  TOGGLE_IMAGE_SELECTION      │
│  • selectedImages: Map<string>   │  SET_TAGS                    │
│  • availableTags: string[]       │  CLEAR_SELECTIONS            │
│  • multiTagMode: boolean         │                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CollectionStore                              │
│                   (Module-level singleton)                       │
├─────────────────────────────────────────────────────────────────┤
│  • collectedImages: Map<string, CollectedImage>                 │
│  • randomSamples: Map<string, CollectedImage>                   │
│  • tagColors: Record<string, string>                            │
│  • collectionTargets: Record<string, number>                    │
│                                                                  │
│  Functions:                                                      │
│  • addBatchToCollection(rois)                                   │
│  • getTagStats(filter) → TagStats[]                             │
│  • calculateClassBalance() → Record<string, number>             │
└─────────────────────────────────────────────────────────────────┘
```

**Design Decision: Separation of UI State and Collection State**

- **AppContext:** Ephemeral UI state (selections, modals, current view)
- **CollectionStore:** Accumulated data across session (can be thousands of images)

This separation allows garbage collection of old batches while preserving collection data.

### 3.3 Coordinate Transformation System

Factory cameras are mounted at 90° rotation. Bounding boxes required transformation:

```typescript
// Original: x1, y1, x2, y2 in rotated frame
// Target: normalized coordinates for display

function transformBoundingBox(box: number[], imageSize: {w: number, h: number}): BoundingBox {
  const [x1, y1, x2, y2] = box;

  // 90° clockwise rotation + vertical flip
  return {
    x: (imageSize.h - y2) / imageSize.h,  // Rotated X
    y: x1 / imageSize.w,                   // Rotated Y
    width: (y2 - y1) / imageSize.h,
    height: (x2 - x1) / imageSize.w
  };
}
```

---

## 4. Data Flow Diagrams

### 4.1 Image Collection Flow

```
┌────────────────┐     ┌────────────────┐     ┌─────────────────┐
│  Socket.io     │────▶│  BatchProcessor│────▶│  AppContext     │
│  (Live Feed)   │     │  (Aggregate)   │     │  (Current View) │
└────────────────┘     └────────────────┘     └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌─────────────────┐     ┌─────────────────┐
                       │CollectionStore  │     │  ImageGrid      │
                       │ (Accumulate)    │     │  (Display 34)   │
                       └─────────────────┘     └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │ DataAnalytics   │
                       │ (Stats/Balance) │
                       └─────────────────┘
```

### 4.2 Upload Flow

```
┌───────────────────────────────────────────────────────────────────┐
│                       Upload Pipeline                              │
├───────────────────────────────────────────────────────────────────┤
│                                                                    │
│  User Selection        Tag Assignment        Upload                │
│  ──────────────        ──────────────        ──────                │
│                                                                    │
│  ┌──────────┐         ┌──────────────┐      ┌──────────────────┐  │
│  │ ImageGrid│───────▶ │ ReviewModal  │─────▶│ API Proxy Route  │  │
│  │ Checkbox │         │ Tag Selector │      │ /api/upload/[id] │  │
│  └──────────┘         └──────────────┘      └──────────────────┘  │
│       │                      │                      │              │
│       ▼                      ▼                      ▼              │
│  selectedImages Map    assignedTags[]        FormData POST        │
│  (batch_id + box)      per image             multipart/form-data  │
│                                                     │              │
│                                                     ▼              │
│                                              Cloud Platform        │
│                                              (ML Training)         │
└───────────────────────────────────────────────────────────────────┘
```

**File Naming Convention:**
```
{tag1}_{tag2}__{cameraId}_{timestamp}.jpg
Example: bad_pin_defect__CAM3_r0_c0_1703001234567.jpg
```

---

## 5. Authentication & Security

### Authentication Flow

```
┌─────────────┐    ┌─────────────────┐    ┌──────────────────┐
│  PIN Entry  │───▶│  Next.js Proxy  │───▶│  Auth Backend    │
│  (5 digits) │    │  /api/auth/*    │    │  /verify_account │
└─────────────┘    └─────────────────┘    └──────────────────┘
                          │                        │
                          │                        ▼
                          │              ┌──────────────────┐
                          │              │  JWT Response    │
                          │              │  access_token    │
                          │              │  id_token        │
                          │              │  user_info       │
                          │              └──────────────────┘
                          │                        │
                          ▼                        ▼
                   ┌─────────────────────────────────────────┐
                   │              AuthContext                 │
                   │  • Store token in localStorage          │
                   │  • Extract user_id from JWT sub claim   │
                   │  • Sync to API client singleton         │
                   └─────────────────────────────────────────┘
```

### Security Considerations

| Concern | Mitigation |
|---------|------------|
| CORS | Next.js API routes as proxy eliminate cross-origin issues |
| Token Storage | localStorage acceptable for desktop kiosk environment |
| Cloud Upload Auth | Separate JWE token for cloud API (v1.cloud.flexiblevision.com) |
| Multi-server Support | Clear auth state when switching servers |

---

## 6. Production Concerns & Solutions

### 6.1 Network Reliability

**Problem:** Factory networks are unstable; WiFi drops, firewall issues

**Solution:** Socket.io with aggressive reconnection

```typescript
// src/lib/socket.ts
const socketConfig = {
  transports: ['polling', 'websocket'],  // Polling fallback
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000
};
```

### 6.2 Memory Management

**Problem:** Streaming 34 images per batch at 1-2 FPS accumulates quickly

**Solutions:**
1. **Batch Queue Limit:** Max 5 batches (configurable)
2. **FIFO Eviction:** Old batches automatically removed
3. **Selection Cleanup:** Clear orphaned selections when batch evicted

```typescript
// AppContext reducer
case 'ADD_BATCH': {
  const newQueue = [...state.batchQueue, action.payload];
  if (newQueue.length > MAX_BATCH_QUEUE) {
    const removed = newQueue.shift();
    // Clean up selections for removed batch
    const cleanedSelections = new Map(state.selectedImages);
    cleanedSelections.forEach((_, key) => {
      if (key.startsWith(removed.id)) cleanedSelections.delete(key);
    });
  }
  return { ...state, batchQueue: newQueue, selectedImages: cleanedSelections };
}
```

### 6.3 Class Balance Problem

**Problem:** Defects are rare; collecting balanced training data is difficult

**Solution:** Built-in analytics with class balance visualization

```typescript
// src/lib/collectionStore.ts
function calculateClassBalance(): Record<string, number> {
  const tagCounts = getTagStats();
  const medianCount = median(Object.values(tagCounts));

  // Target: match median count for each class
  return Object.fromEntries(
    tagCounts.map(({ tag, count }) => [tag, medianCount - count])
  );
}
```

### 6.4 Random Sampling

**Problem:** Operators tend to only collect "interesting" images, biasing dataset

**Solution:** Configurable random sampling with separate storage

```typescript
// CollectionStore
let samplingConfig = { enabled: false, rate: 0.1, target: 100 };

function addBatchToCollection(rois: ROIImage[]) {
  for (const roi of rois) {
    // Always add to main collection
    collectedImages.set(id, image);

    // Random sampling with configured rate
    if (samplingConfig.enabled && Math.random() < samplingConfig.rate) {
      if (randomSamples.size < samplingConfig.target) {
        randomSamples.set(id, { ...image, isRandomSample: true });
      }
    }
  }
}
```

---

## 7. Component Architecture

### Component Hierarchy

```
Page (src/app/page.tsx)
├── AuthProvider
├── AppProvider
│   └── VisionLoopApp
│       ├── Header
│       │   └── Status indicators, Settings, Login
│       │
│       ├── Main Content Area
│       │   ├── BatchCarousel (when paused)
│       │   └── ImageGrid
│       │       └── ImageCard[] (34 cards)
│       │           └── ImageWithBoundingBoxes
│       │
│       ├── Sidebar
│       │   ├── Selection counter
│       │   ├── Review/Upload buttons
│       │   └── Tag selector (multi-select mode)
│       │
│       ├── Footer
│       │   └── FPS, Connection, Model info
│       │
│       └── Modals
│           ├── ImageReviewModal (carousel + zoom)
│           ├── SettingsModal (connection config)
│           ├── DataAnalytics (stats dashboard)
│           ├── CollectionManager (bulk download)
│           └── LoginPinpad
```

### Key UI/UX Decisions

1. **Fixed Grid Layout:** 34 positions match physical camera array
2. **Pause/Resume:** Freeze stream to allow careful selection
3. **Multi-Tag Mode:** Apply multiple labels simultaneously
4. **Keyboard Navigation:** Arrow keys in review modal for speed
5. **Dark Theme:** Reduce eye strain in factory lighting

---

## 8. Deployment Architecture

### Docker Configuration

```yaml
# docker-compose.yml
services:
  visionloop:
    build: .
    ports:
      - "3080:3080"
    environment:
      - NEXT_PUBLIC_SOCKET_HOST=${SOCKET_HOST}
      - NEXT_PUBLIC_SOCKET_PORT=5000
```

### Multi-Stage Dockerfile

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3080
CMD ["npm", "start"]
```

### Environment Configuration

| Variable | Purpose | Example |
|----------|---------|---------|
| `NEXT_PUBLIC_SOCKET_HOST` | Inspection server IP | `192.168.1.100` |
| `NEXT_PUBLIC_SOCKET_PORT` | Socket.io port | `5000` |
| `NEXT_PUBLIC_API_BASE_URL` | Auth/API endpoint | `http://192.168.1.100:8000` |

---

## 9. Metrics & Monitoring

### Performance Targets (Achieved)

| Metric | Target | Achieved |
|--------|--------|----------|
| Initial Load | <3s | 2.1s |
| Batch Render | <16ms (60fps) | 12ms |
| WebSocket Latency | <100ms | 45ms avg |
| Memory Usage | <300MB | 180MB typical |

### Observability

- **Console Logging:** `[ComponentName] action details`
- **Data Inspector:** Capture raw WebSocket messages for debugging
- **Connection Status:** Real-time indicator in footer

---

## 10. Future Enhancements (Backlog)

1. **Offline Mode:** IndexedDB storage for unreliable network
2. **Multi-workspace:** Support multiple inspection stations
3. **Active Learning:** Suggest which images to label next
4. **Annotation Tools:** Draw bounding boxes in browser
5. **Model Comparison:** A/B test model versions in production

---

## Summary: Key Technical Decisions

| Decision | Context | Trade-off Made |
|----------|---------|----------------|
| Next.js API Proxy | CORS issues with direct API calls | Added latency but eliminated browser security issues |
| 1000ms Batch Window | Async camera messages | Slight delay but 99.5%+ message completeness |
| Module-level CollectionStore | Persist data across renders | Less "React-like" but simpler than Redux |
| localStorage for Auth | Desktop kiosk environment | Acceptable security for isolated network |
| Base64 Image Transfer | Simplify upload pipeline | Larger payload but eliminates file handling |

---

## Questions I'm Prepared to Discuss

1. **Why not use Redux or Zustand?** - Evaluated complexity vs. team familiarity
2. **How do you handle camera failures?** - Graceful degradation, missing slots
3. **What about horizontal scaling?** - Current architecture, future considerations
4. **Security audit findings?** - Token handling, network isolation
5. **How did you measure the 1000ms window?** - Production logs analysis

---

*Document prepared for architecture discussion interview - February 2026*
