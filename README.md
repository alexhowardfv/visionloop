# Vision Loop Frontend

A real-time inspection system front-end built with Next.js 14, TypeScript, and Socket.io for displaying and reviewing ROI images from industrial quality control systems.

## Features

- **Real-time Image Display**: View 34 ROI images from WebSocket stream
- **Batch Queue Management**: Pause stream and review last 5 batches
- **Multi-Batch Selection**: Select images across multiple batches for review
- **Image Review Modal**: Large-view carousel for detailed defect inspection
- **Tag-Based Naming**: Assign custom tags to images before submission
- **Dark Theme UI**: Professional glassmorphism design with status indicators
- **Dockerized Deployment**: Production-ready containerization

## Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Real-time**: Socket.io Client
- **State Management**: React Context API
- **Container**: Docker + Docker Compose

## Prerequisites

- Node.js 18+ (for local development)
- Docker & Docker Compose (for containerized deployment)
- Access to Socket.io server (port 5000)
- Access to API server (port 8000)

## Installation

### Local Development

1. **Clone the repository**
```bash
cd Visionloop
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:
```env
NEXT_PUBLIC_SOCKET_HOST=localhost
NEXT_PUBLIC_SOCKET_PORT=5000
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_MODEL_NAME=DefectNet
NEXT_PUBLIC_MODEL_VERSION=v2.1
AUTH_TOKEN=your_auth_token_here
```

4. **Run development server**
```bash
npm run dev
```

The application will be available at `http://localhost:6900`

### Docker Deployment

1. **Configure environment**

Create a `.env` file or use environment variables:
```env
SOCKET_HOST=your-socket-host
SOCKET_PORT=5000
API_BASE_URL=http://your-api-host:8000
MODEL_NAME=DefectNet
MODEL_VERSION=v2.1
AUTH_TOKEN=your_auth_token_here
```

2. **Build and run with Docker Compose**
```bash
docker-compose up -d
```

3. **Check logs**
```bash
docker-compose logs -f vision-loop-frontend
```

4. **Access the application**

Open `http://localhost:6900` in your browser

### Production Build (Manual)

```bash
npm run build
npm start
```

## Configuration

### Camera Mapping

The application displays 34 ROI images mapped to specific cameras. The mapping is defined in `src/lib/constants.ts`:

- Boxes 1-32: Main inspection cameras (CAM2-CAM9)
- Box 33: Left side indicator (CAM1)
- Box 34: Right side indicator (CAM10)

### Tags Configuration

Default tags are defined in `src/lib/constants.ts`. Tags can also be fetched dynamically from the API endpoint:

```
GET /api/tags?model={modelName}&version={versionNumber}
```

Default tags:
- Defect
- Missing Paint
- Label Flag
- Print Defect
- Scratch
- Dent
- Contamination

## API Endpoints

### 1. Get Tags

```
GET /api/tags?model={modelName}&version={versionNumber}
Response: { tags: string[] }
```

### 2. Add to Project

```
POST /api/project/add
Headers: { Authorization: Bearer ${authToken} }
Body: {
  model: string,
  version: string,
  images: [{
    originalName: string,
    newName: string,
    cameraId: string,
    batchId: string,
    result: string,
    imageData: string
  }]
}
Response: { success: boolean, added: number }
```

### 3. WebSocket Connection

```
Socket Event: "responseMessage"
Data: {
  overall_pass_fail: 'PASS' | 'FAIL' | 'UNKNOWN',
  total_inputs: number,
  total_time: number,
  model: string,
  version: string,
  results: {
    [cameraId: string]: {
      result: 'PASS' | 'FAIL',
      reason: string,
      image: string // Base64 encoded
    }
  }
}
```

## Usage Guide

### Viewing Real-time Inspection

1. The system automatically connects to the WebSocket server
2. Images update in real-time as batches arrive
3. Status indicators show PASS/FAIL/UNKNOWN for each ROI

### Pausing and Reviewing Batches

1. Click **PAUSE** button in the header
2. Use the batch carousel to navigate through the last 5 batches
3. Click **RESUME** to return to live streaming mode

### Selecting and Reviewing Images

1. **Select images**: Click on any image card to select/deselect
2. **Multi-batch selection**: Navigate between batches while maintaining selections
3. **Review selected**: Click "Review Selected Images" in the sidebar
4. **Large view inspection**: Use the modal to inspect each image in detail

### Tagging and Adding to Project

1. **In Review Modal**:
   - Select one or more tags for the current image
   - Click "Add This Image to Project" to submit single image
   - Click "Add All Remaining" to batch submit with same tags

2. **Multi-tag mode** (Sidebar):
   - Toggle "Multi-Tag Mode" to select multiple tags simultaneously
   - Single mode allows only one tag selection at a time

### Keyboard Shortcuts (Review Modal)

- `←` Previous image
- `→` Next image
- `Esc` Close modal

## Project Structure

```
Visionloop/
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── page.tsx           # Main page
│   │   ├── layout.tsx         # Root layout
│   │   └── globals.css        # Global styles
│   ├── components/            # React components
│   │   ├── Header.tsx
│   │   ├── ImageCard.tsx
│   │   ├── ImageGrid.tsx
│   │   ├── BatchCarousel.tsx
│   │   ├── Sidebar.tsx
│   │   ├── ImageReviewModal.tsx
│   │   ├── Notification.tsx
│   │   └── Footer.tsx
│   ├── contexts/              # React context
│   │   └── AppContext.tsx
│   ├── hooks/                 # Custom hooks
│   │   ├── useWebSocket.ts
│   │   └── useNotification.ts
│   ├── lib/                   # Utilities
│   │   ├── api.ts
│   │   ├── socket.ts
│   │   ├── batchProcessor.ts
│   │   ├── imageNaming.ts
│   │   └── constants.ts
│   └── types/                 # TypeScript definitions
│       └── index.ts
├── public/                    # Static assets
├── Dockerfile                 # Docker configuration
├── docker-compose.yml         # Docker Compose setup
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
├── tailwind.config.ts         # Tailwind CSS config
└── README.md                  # This file
```

## Docker Commands

```bash
# Build the image
docker-compose build

# Start the container
docker-compose up -d

# Stop the container
docker-compose down

# View logs
docker-compose logs -f

# Restart the container
docker-compose restart

# Execute commands in container
docker-compose exec vision-loop-frontend sh
```

## Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NEXT_PUBLIC_SOCKET_HOST` | Socket.io server hostname | localhost | Yes |
| `NEXT_PUBLIC_SOCKET_PORT` | Socket.io server port | 5000 | Yes |
| `NEXT_PUBLIC_API_BASE_URL` | API server base URL | http://localhost:8000 | Yes |
| `NEXT_PUBLIC_MODEL_NAME` | Inspection model name | DefectNet | Yes |
| `NEXT_PUBLIC_MODEL_VERSION` | Model version | v2.1 | Yes |
| `AUTH_TOKEN` | API authentication token | - | Yes |
| `PORT` | Application port | 6900 | No |

## Troubleshooting

### WebSocket Connection Issues

1. **Check server availability**
```bash
curl http://{SOCKET_HOST}:{SOCKET_PORT}
```

2. **Verify CORS settings** on the Socket.io server

3. **Check browser console** for connection errors

### API Request Failures

1. **Verify API_BASE_URL** is correct
2. **Check AUTH_TOKEN** is valid
3. **Inspect network tab** in browser DevTools

### Docker Build Failures

1. **Clear Docker cache**
```bash
docker-compose build --no-cache
```

2. **Check Docker logs**
```bash
docker-compose logs
```

### Port Already in Use

```bash
# Change port in docker-compose.yml
ports:
  - "7000:6900"  # Use port 7000 instead
```

## Performance Optimization

- **Image Compression**: Consider compressing Base64 images on the server
- **Batch Throttling**: Limit WebSocket message frequency if needed
- **Lazy Loading**: Images load on-demand in the grid
- **Memory Management**: Only 5 batches kept in memory (170 images max)

## Security Considerations

- **AUTH_TOKEN**: Never commit tokens to version control
- **Environment Variables**: Use `.env.local` for local development
- **HTTPS**: Use HTTPS in production for WebSocket and API
- **CORS**: Configure appropriate CORS policies on backend

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

Proprietary - All rights reserved

## Support

For issues, questions, or feature requests, contact the development team.

---

Built with Next.js and TypeScript. Powered by Socket.io for real-time updates.
