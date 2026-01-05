# GIF Converter - Development Reference

Video/image to GIF converter using ffmpeg's 3-pass palette pipeline.

## Quick Start

```bash
# Docker (production)
docker network create vision_network  # if not exists
docker compose up -d --build

# Local development (requires Redis on port 6379)
nvm use 20
npm install
npm run dev
```

Access at **http://localhost:5051**

## Architecture

```
Frontend (React 18 + Vite + TypeScript)
├── State: Zustand (jobStore, settingsStore, uploadStore)
├── Data: TanStack React Query
├── Real-time: WebSocket
└── UI: Tailwind + Radix primitives

Backend (Express + TypeScript)
├── Routes: /api/upload, /api/jobs, /api/download, /api/queue
├── Services: conversion, queue, compressor, cleanup
├── Database: SQLite (better-sqlite3)
└── PubSub: Redis

Conversion Pipeline (ffmpeg)
├── Pass 1: Input → filtered MP4 (scale, rotate, interpolate)
├── Pass 2: MP4 → optimized palette
└── Pass 3: MP4 + palette → GIF
```

## Key Files

### Backend

| File | Purpose |
|------|---------|
| `server/types.ts` | Shared type definitions |
| `server/db/client.ts` | SQLite operations |
| `server/services/conversion.ts` | ffmpeg 3-pass pipeline |
| `server/services/queue.ts` | p-queue job processing |
| `server/services/compressor.ts` | gif-compressor integration |
| `server/routes/upload.ts` | File upload handling |
| `server/websocket.ts` | Real-time progress updates |

### Frontend

| File | Purpose |
|------|---------|
| `src/store/jobStore.ts` | Real-time job state + session |
| `src/store/settingsStore.ts` | Persisted conversion options |
| `src/hooks/useWebSocket.ts` | WebSocket connection |
| `src/hooks/useJobs.ts` | React Query hooks |
| `src/components/jobs/JobCard.tsx` | Job display with progress |
| `src/components/settings/GlobalSettings.tsx` | Conversion options UI |

## API Endpoints

```
POST /api/upload              Upload files + options → job IDs
GET  /api/jobs                List jobs (filter: status, filename, session_id)
GET  /api/jobs/:id            Get job details
DELETE /api/jobs/:id          Delete job + files
POST /api/jobs/:id/retry      Retry failed job

GET  /api/download/:id        Download converted GIF
GET  /api/download/:id/original  Download source file
GET  /api/download/zip/archive?ids=a,b,c  Bulk download

GET  /api/queue/config        Get concurrency
PUT  /api/queue/config        Set concurrency
GET  /api/health              Health check
```

## Conversion Options

```typescript
interface ConversionOptions {
  width: number | null;           // Output width (null = auto)
  height: number | null;          // Output height (null = auto)
  transpose: 0 | 1 | 2 | 3;       // 0=none, 1=90CW, 2=90CCW, 3=180
  input_fps: number | null;       // Override input frame rate
  output_fps: number | null;      // Target output frame rate
  minterpolate_fps: number | null; // Motion interpolation (slow)
  background_color: string | null; // Hex or color name
  background_image_id: string | null;
  compress_output: boolean;       // Send to gif-compressor after
}
```

## Environment Variables

Configure via `.env` (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST_PORT` | 5051 | External port |
| `COMPRESSOR_URL` | http://gif-compressor:5050 | Compression service |
| `DEFAULT_CONCURRENCY` | 2 | Initial parallel jobs |
| `MAX_CONCURRENCY` | 10 | Max parallel jobs |
| `GIF_RETENTION_TTL` | _(empty)_ | Auto-cleanup seconds |
| `DOCKER_NETWORK` | vision_network | Shared network |

## Job Statuses

```
uploading → queued → processing → [compressing] → completed
                 ↘→ failed
```

Progress during `processing`:
- 0-33%: Pass 1 (filtering)
- 33-66%: Pass 2 (palette generation)
- 66-100%: Pass 3 (GIF encoding)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, TypeScript |
| State | Zustand (persisted) |
| Data | TanStack React Query v5 |
| Real-time | WebSocket + Redis pub/sub |
| Styling | Tailwind CSS + Radix UI |
| Backend | Express.js + TypeScript |
| Database | SQLite (better-sqlite3) |
| Queue | p-queue |
| Conversion | ffmpeg |
| Container | Docker + Docker Compose |
