# GIF Converter

A Docker-based service that converts images and videos to high-quality GIFs using ffmpeg's 3-pass palette pipeline. Optionally integrates with gif-compressor for post-conversion compression.

## Quick Start

```bash
# Production (Docker)
docker-compose up --build

# Development (requires local Redis on port 6379)
npm install
npm run dev
```

Access the app at **http://localhost:5051**

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  React 18 + Vite + TypeScript + Tailwind + Radix UI         │
│  State: Zustand | Data: TanStack React Query                │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP + WebSocket
┌─────────────────────▼───────────────────────────────────────┐
│                        Backend                               │
│  Express.js + TypeScript                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Routes    │  │   Queue     │  │  Convert    │         │
│  │  /api/*     │  │  p-queue    │  │  ffmpeg     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                           │                  │
│                                    ┌──────▼──────┐          │
│                                    │ Compressor  │          │
│                                    │ Integration │          │
│                                    └─────────────┘          │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                     Data Layer                               │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │  SQLite             │  │  Redis              │          │
│  │  Job persistence    │  │  Pub/sub for        │          │
│  │  + history          │  │  real-time updates  │          │
│  └─────────────────────┘  └─────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
                      │
              (optional, shared network)
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                  gif-compressor                              │
│  POST /api/upload → compressed GIF                          │
└─────────────────────────────────────────────────────────────┘
```

## Features

- **Drag/drop multiple files** for batch conversion
- **Video + Image input**: MP4, MOV, AVI, WebM, PNG, JPG, TIFF, WebP
- **3-pass ffmpeg pipeline** for high-quality palette-based GIFs
- **Full conversion controls**: dimensions, rotation, frame rates, backgrounds
- **Motion interpolation** for smooth slow-motion effects
- **Background compositing**: solid colors or uploaded images
- **Optional gif-compressor integration** for post-conversion compression
- **Real-time progress** via WebSocket (per-pass tracking)
- **Download individual** converted files or **all as ZIP**

## Conversion Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `width` | number | null | Target width (-1 for auto) |
| `height` | number | null | Target height (-1 for auto) |
| `transpose` | 0-3 | 0 | Rotation: 0=none, 1=90CW, 2=90CCW, 3=180 |
| `input_fps` | number | null | Input frame rate override |
| `output_fps` | number | null | Output frame rate |
| `minterpolate_fps` | number | null | Motion interpolation target FPS |
| `background_color` | string | null | Hex/named color for transparent inputs |
| `background_image` | file | null | Image file for background layer |
| `compress_output` | boolean | false | Send to gif-compressor after conversion |

## API Endpoints

### Upload & Download
- `POST /api/upload` - Upload file(s) with conversion options
- `GET /api/download/:jobId` - Download converted GIF
- `GET /api/download/:jobId/original` - Download original file
- `GET /api/download/zip/archive?ids=a,b,c` - Download multiple as ZIP

### Jobs
- `GET /api/jobs` - List jobs (query: `status`, `filename`, `limit`, `offset`)
- `GET /api/jobs/counts` - Get counts by status
- `GET /api/jobs/:id` - Get single job
- `DELETE /api/jobs/:id` - Delete job and files
- `POST /api/jobs/:id/retry` - Retry failed job

### Queue & System
- `GET /api/queue/config` - Get concurrency setting
- `PUT /api/queue/config` - Set concurrency (`{ "concurrency": N }`)
- `GET /api/health` - Health check

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 5050 | Server port |
| `REDIS_URL` | redis://redis:6379/0 | Redis connection |
| `DATABASE_PATH` | /app/data/gif-converter.db | SQLite path |
| `UPLOAD_DIR` | /app/uploads | Uploaded files |
| `OUTPUT_DIR` | /app/output | Converted files |
| `TEMP_DIR` | /tmp/gif-converter | ffmpeg temp files |
| `GIF_RETENTION_TTL` | (empty) | Auto-cleanup seconds |
| `DEFAULT_CONCURRENCY` | 2 | Initial queue concurrency |
| `MAX_CONCURRENCY` | 10 | Max concurrency |
| `MAX_FILE_SIZE` | 104857600 | Max upload (100MB) |
| `COMPRESSOR_URL` | http://gif-compressor:5050 | gif-compressor API URL |

## Project Structure

```
gif-converter/
├── docker-compose.yml
├── Dockerfile
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.server.json
├── server/
│   ├── index.ts
│   ├── websocket.ts
│   ├── types.ts
│   ├── db/
│   │   ├── schema.ts
│   │   └── client.ts
│   ├── routes/
│   │   ├── upload.ts
│   │   ├── jobs.ts
│   │   ├── download.ts
│   │   └── queue.ts
│   └── services/
│       ├── conversion.ts      # ffmpeg 3-pass pipeline
│       ├── compressor.ts      # gif-compressor integration
│       ├── queue.ts
│       └── cleanup.ts
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── api/
    │   ├── types.ts
    │   └── client.ts
    ├── components/
    │   ├── ui/
    │   ├── upload/
    │   │   ├── DropZone.tsx
    │   │   └── FileList.tsx
    │   ├── settings/
    │   │   ├── GlobalSettings.tsx
    │   │   ├── PerImageSettings.tsx
    │   │   └── QueueSettings.tsx
    │   ├── jobs/
    │   │   ├── JobList.tsx
    │   │   ├── JobCard.tsx
    │   │   ├── JobFilters.tsx
    │   │   └── JobStatusBadge.tsx
    │   └── layout/
    │       └── Header.tsx
    ├── hooks/
    │   ├── useJobs.ts
    │   └── useWebSocket.ts
    ├── store/
    │   ├── settingsStore.ts
    │   ├── uploadStore.ts
    │   └── jobsStore.ts
    └── pages/
        ├── HomePage.tsx
        └── HistoryPage.tsx
```

---

# Implementation Plan

## Phase 1: Project Setup

### 1.1 Copy Base Structure from gif-compressor
Copy these files/directories as starting point:
- `package.json` (update name, description)
- `tsconfig.json`, `tsconfig.server.json`, `tsconfig.node.json`
- `vite.config.ts`
- `tailwind.config.js`
- `index.html`
- `.nvmrc`, `.dockerignore`
- `src/components/ui/` (Radix UI primitives - unchanged)
- `src/index.css` (Tailwind styles - unchanged)

### 1.2 Create New Configuration Files
- `Dockerfile` - Multi-stage build with ffmpeg instead of gifsicle
- `docker-compose.yml` - Port 5051, shared network with gif-compressor
- `.env.example` - Environment variables

## Phase 2: Backend Core

### 2.1 Types (`server/types.ts`)
```typescript
export type JobStatus = "uploading" | "queued" | "processing" | "compressing" | "completed" | "failed";
export type InputType = "video" | "image";
export type TransposeValue = 0 | 1 | 2 | 3;

export interface ConversionOptions {
  width: number | null;
  height: number | null;
  transpose: TransposeValue;
  input_fps: number | null;
  output_fps: number | null;
  minterpolate_fps: number | null;
  background_color: string | null;
  background_image_id: string | null;
  compress_output: boolean;
}
```

### 2.2 Database Schema (`server/db/schema.ts`)
Key changes from gif-compressor:
- Add `current_pass` (1-3) for progress tracking
- Add `input_type` (video/image)
- Add `original_duration`, `original_frame_count`
- Add `background_image_path`
- Add `compress_output` flag
- Rename `compressed_*` → `converted_*`

### 2.3 Conversion Service (`server/services/conversion.ts`)
Implement ffmpeg 3-pass pipeline:

**Pass 1**: Convert to temp MP4 with filters
```bash
ffmpeg -y [-f lavfi -i color=<bg>] [-loop 1 -i <bg_image>] [-r <input_fps>] -i <input>
  [-filter_complex "<bg_overlay>,scale=W:H,transpose=T,minterpolate=..."]
  -c:v libx264 -crf 18 -preset veryslow -an <temp.mp4>
```

**Pass 2**: Generate optimized palette
```bash
ffmpeg -y -i <temp.mp4> -filter_complex "[0:v] palettegen" <palette.png>
```

**Pass 3**: Create GIF using palette
```bash
ffmpeg -y -i <temp.mp4> -i <palette.png> -filter_complex "[0:v][1:v] paletteuse" -r <fps> <output.gif>
```

Progress tracking:
- Parse ffmpeg stderr for `Duration:` and `time=`
- Report 0-33% for Pass 1, 33-66% for Pass 2, 66-100% for Pass 3

### 2.4 Compressor Integration (`server/services/compressor.ts`)
```typescript
export async function compressGif(gifPath: string): Promise<{path: string, size: number}> {
  const formData = new FormData();
  formData.append('files', fs.createReadStream(gifPath));

  const response = await fetch(`${COMPRESSOR_URL}/api/upload`, {
    method: 'POST',
    body: formData
  });

  // Poll job status until complete
  // Download compressed file
  // Return new path and size
}
```

### 2.5 Queue Service (`server/services/queue.ts`)
Modify from gif-compressor:
- Call `convertToGif()` instead of `compressGif()`
- Track 3-pass progress with `current_pass`
- If `compress_output` enabled, call compressor integration after conversion
- Add "compressing" status for compression phase

## Phase 3: API Routes

### 3.1 Upload Route (`server/routes/upload.ts`)
Changes:
- Accept video + image MIME types
- Handle optional background image upload (separate form field)
- Detect input type from file extension
- Store background image path in job

Supported MIME types:
```typescript
const SUPPORTED_MIMETYPES = [
  "video/mp4", "video/quicktime", "video/x-msvideo", "video/webm",
  "image/png", "image/jpeg", "image/tiff", "image/webp"
];
```

### 3.2 Download Route (`server/routes/download.ts`)
Minor changes:
- Output always has `.gif` extension
- Filename: `{original}-converted.gif`

### 3.3 Jobs & Queue Routes
Copy from gif-compressor with minimal changes.

## Phase 4: Frontend

### 4.1 Types (`src/api/types.ts`)
Match server types with ConversionOptions interface.

### 4.2 Settings Store (`src/store/settingsStore.ts`)
```typescript
const DEFAULT_OPTIONS: ConversionOptions = {
  width: null,
  height: null,
  transpose: 0,
  input_fps: null,
  output_fps: null,
  minterpolate_fps: null,
  background_color: null,
  background_image_id: null,
  compress_output: false,
};
```

### 4.3 Upload Store (`src/store/uploadStore.ts`)
Update accepted file types for video + image formats.

### 4.4 GlobalSettings Component (`src/components/settings/GlobalSettings.tsx`)
Full controls UI:
- **Dimensions**: Width/Height number inputs with "Auto" placeholder
- **Rotation**: Select dropdown (None, 90° CW, 90° CCW, 180°)
- **Frame Rates**: Three inputs (Input FPS, Output FPS, Interpolate FPS)
- **Background Color**: Text input + color picker
- **Background Image**: File input with preview
- **Compress Output**: Checkbox with "Send to gif-compressor" label

### 4.5 DropZone Component (`src/components/upload/DropZone.tsx`)
Update accept string:
```typescript
const ACCEPT_STRING = ".mp4,.mov,.avi,.webm,.png,.jpg,.jpeg,.tiff,.tif,.webp";
```

### 4.6 JobCard Component (`src/components/jobs/JobCard.tsx`)
Changes:
- Show input type badge (video/image icon)
- Show pass progress: "Pass 1/3", "Pass 2/3", "Pass 3/3"
- Show "Compressing..." status when sending to gif-compressor
- Remove reduction percentage display

## Phase 5: Docker Configuration

### 5.1 Dockerfile
```dockerfile
FROM node:20-alpine AS builder
# Build stage - same as gif-compressor

FROM node:20-alpine AS production
# Install ffmpeg instead of gifsicle
RUN apk add --no-cache ffmpeg curl
# ... rest similar
```

### 5.2 docker-compose.yml
```yaml
version: '3.8'

services:
  gif-converter:
    build: .
    container_name: gif-converter
    ports:
      - "5051:5050"
    environment:
      - COMPRESSOR_URL=http://gif-compressor:5050
    networks:
      - gif-network
    # ... volumes, depends_on, etc.

  redis:
    image: redis:7-alpine
    container_name: converter-redis
    networks:
      - gif-network
    # ...

networks:
  gif-network:
    external: true
    name: gif-compressor_default  # Connect to compressor's network
```

### 5.3 Network Setup
Option A: External network (recommended)
```bash
docker network create gif-services
# Update both docker-compose files to use this network
```

Option B: Reference compressor's network
```yaml
networks:
  gif-network:
    external: true
    name: gif-compressor_default
```

## Phase 6: Integration & Testing

### 6.1 Test Cases
- [ ] Convert MP4 to GIF
- [ ] Convert MOV to GIF
- [ ] Convert PNG to GIF (single frame)
- [ ] Convert JPG to GIF (single frame)
- [ ] Resize: width only, height only, both
- [ ] Rotation: all 4 transpose values
- [ ] Frame rate changes
- [ ] Motion interpolation
- [ ] Background color on transparent PNG
- [ ] Background image compositing
- [ ] Compress output via gif-compressor
- [ ] Batch conversion (multiple files)
- [ ] Progress tracking accuracy
- [ ] Error handling (invalid files, ffmpeg failures)

### 6.2 Integration with gif-compressor
- [ ] Verify network connectivity
- [ ] Test upload to compressor API
- [ ] Handle compressor unavailable gracefully
- [ ] Display compression results (size reduction)

---

## Critical Files to Reference

| File | Purpose |
|------|---------|
| `~/bin/convert.sh` | ffmpeg pipeline reference |
| `~/dev/resources/repo/gif-compressor/server/services/compression.ts` | Service pattern |
| `~/dev/resources/repo/gif-compressor/server/services/queue.ts` | Queue integration |
| `~/dev/resources/repo/gif-compressor/server/db/schema.ts` | Schema pattern |
| `~/dev/resources/repo/gif-compressor/src/components/settings/GlobalSettings.tsx` | UI pattern |
| `~/dev/resources/repo/gif-compressor/docker-compose.yml` | Docker setup |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, TypeScript |
| State | Zustand (persisted) |
| Data Fetching | TanStack React Query v5 |
| Real-time | WebSocket + Redis pub/sub |
| Styling | Tailwind CSS + Radix UI |
| Backend | Express.js + TypeScript |
| Database | SQLite (better-sqlite3) |
| Cache/PubSub | Redis 7 |
| Conversion | ffmpeg |
| Queue | p-queue |
| Container | Docker + Docker Compose |
