# Vision Loop - Deployment Checklist

## Pre-Deployment Checklist

### 1. Environment Configuration

- [ ] Copy `.env.example` to `.env`
- [ ] Set `SOCKET_HOST` to production Socket.io server
- [ ] Set `SOCKET_PORT` (default: 5000)
- [ ] Set `API_BASE_URL` to production API server
- [ ] Set `MODEL_NAME` to correct model
- [ ] Set `MODEL_VERSION` to correct version
- [ ] Set `AUTH_TOKEN` to production token
- [ ] Verify all environment variables are correct

### 2. Backend Requirements

- [ ] Socket.io server is running and accessible
- [ ] Socket.io server configured for CORS (allows frontend origin)
- [ ] API server is running and accessible
- [ ] API endpoints `/api/tags` and `/api/project/add` are working
- [ ] Authentication token is valid
- [ ] WebSocket event "responseMessage" is configured

### 3. Network Configuration

- [ ] Port 6900 is open and accessible
- [ ] Firewall rules allow traffic on port 6900
- [ ] SSL/TLS certificates configured (for HTTPS, recommended)
- [ ] Domain/subdomain DNS configured (if applicable)

### 4. Docker Setup

- [ ] Docker installed (version 20.10+)
- [ ] Docker Compose installed (version 1.29+)
- [ ] Sufficient disk space (minimum 2GB)
- [ ] Docker daemon is running

## Deployment Steps

### Option A: Docker Compose (Recommended)

```bash
# 1. Navigate to project directory
cd Visionloop

# 2. Build the Docker image
docker-compose build

# 3. Start the container
docker-compose up -d

# 4. Verify container is running
docker-compose ps

# 5. Check logs for errors
docker-compose logs -f vision-loop-frontend

# 6. Test health check
curl http://localhost:6900

# 7. Access application in browser
# http://your-domain:6900 or http://localhost:6900
```

### Option B: Manual Docker

```bash
# 1. Build image
docker build -t vision-loop-frontend:latest .

# 2. Run container
docker run -d \
  --name vision-loop-frontend \
  -p 6900:6900 \
  -e NEXT_PUBLIC_SOCKET_HOST=your-socket-host \
  -e NEXT_PUBLIC_SOCKET_PORT=5000 \
  -e NEXT_PUBLIC_API_BASE_URL=http://your-api-host:8000 \
  -e NEXT_PUBLIC_MODEL_NAME=DefectNet \
  -e NEXT_PUBLIC_MODEL_VERSION=v2.1 \
  -e AUTH_TOKEN=your_token \
  --restart unless-stopped \
  vision-loop-frontend:latest

# 3. Check logs
docker logs -f vision-loop-frontend
```

### Option C: Node.js (Production)

```bash
# 1. Install dependencies
npm ci --only=production

# 2. Build application
npm run build

# 3. Start application
npm start

# 4. Use process manager (recommended)
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start npm --name "vision-loop" -- start

# Save PM2 process list
pm2 save

# Setup auto-restart on reboot
pm2 startup
```

## Post-Deployment Verification

### 1. Basic Functionality

- [ ] Application loads at http://your-domain:6900
- [ ] No console errors in browser DevTools
- [ ] UI renders correctly (header, sidebar, footer visible)
- [ ] Dark theme applied correctly

### 2. WebSocket Connection

- [ ] Connection status shows "Connected" (green dot in header)
- [ ] Check browser console for Socket.io connection logs
- [ ] Verify no connection errors

### 3. Real-time Updates

- [ ] Images appear in grid (34 ROI positions)
- [ ] Images update when new batches arrive
- [ ] Status badges show correct PASS/FAIL/UNKNOWN
- [ ] Overall status indicator updates

### 4. User Interactions

- [ ] Pause button works (changes to Resume)
- [ ] Batch carousel appears when paused
- [ ] Can navigate between batches
- [ ] Resume returns to live view
- [ ] Image selection works (checkbox appears)
- [ ] Selected count updates in sidebar

### 5. Review Modal

- [ ] "Review Selected" button enabled when images selected
- [ ] Modal opens with large image view
- [ ] Navigation (Previous/Next) works
- [ ] Tag selection works
- [ ] "Add to Project" submits successfully
- [ ] Success notification appears

### 6. API Integration

- [ ] Tags load from API (check sidebar)
- [ ] "Add to Project" API call succeeds
- [ ] Error notifications appear for failures
- [ ] Check network tab for API requests

## Monitoring

### Health Check

```bash
# Manual health check
curl http://localhost:6900

# Expected response: HTTP 200
```

### Docker Health Status

```bash
# Check container health
docker ps --filter name=vision-loop-frontend

# Should show "healthy" status
```

### Application Logs

```bash
# Docker Compose
docker-compose logs -f

# Docker
docker logs -f vision-loop-frontend

# PM2
pm2 logs vision-loop
```

### Performance Metrics

```bash
# Docker stats
docker stats vision-loop-frontend

# Monitor: CPU %, Memory, Network I/O
```

## Troubleshooting

### Container Won't Start

```bash
# Check Docker logs
docker-compose logs

# Rebuild without cache
docker-compose build --no-cache

# Check port availability
netstat -tuln | grep 6900
```

### WebSocket Connection Failed

1. Verify Socket.io server is accessible:
```bash
curl http://your-socket-host:5000
```

2. Check CORS configuration on Socket.io server

3. Inspect browser console for specific errors

4. Test WebSocket connection manually

### API Calls Failing

1. Verify API server is accessible:
```bash
curl http://your-api-host:8000/api/tags?model=DefectNet&version=v2.1
```

2. Check AUTH_TOKEN is correct

3. Verify API endpoints are implemented

4. Check network tab in browser DevTools

### Images Not Displaying

1. Verify Socket.io data format matches specification
2. Check image data is Base64 encoded correctly
3. Inspect browser console for image load errors
4. Test with sample data

## Maintenance

### Update Application

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d
```

### Backup Configuration

```bash
# Backup environment file
cp .env .env.backup.$(date +%Y%m%d)
```

### View Logs

```bash
# Last 100 lines
docker-compose logs --tail=100

# Follow logs
docker-compose logs -f

# Specific time range
docker-compose logs --since="2024-01-15T10:00:00"
```

### Restart Application

```bash
# Docker Compose
docker-compose restart

# Docker
docker restart vision-loop-frontend

# PM2
pm2 restart vision-loop
```

## Security Checklist

- [ ] AUTH_TOKEN not committed to version control
- [ ] .env file not committed to version control
- [ ] HTTPS enabled for production
- [ ] Secure WebSocket (WSS) used if over HTTPS
- [ ] CORS properly configured
- [ ] Container runs as non-root user (built-in)
- [ ] Regular security updates applied

## Performance Optimization

- [ ] Image compression enabled on backend
- [ ] CDN configured (if applicable)
- [ ] Rate limiting implemented on API
- [ ] WebSocket message throttling (if needed)
- [ ] Monitoring and alerting setup

## Support Contacts

- **Development Team**: [Your team contact]
- **Infrastructure**: [Infrastructure contact]
- **Emergency**: [Emergency contact]

---

Deployment completed! Monitor the system for 24-48 hours to ensure stability.
