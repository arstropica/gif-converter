# GIF Converter

A Docker-based service that converts videos and images to high-quality GIFs using ffmpeg's 3-pass palette pipeline. Optionally integrates with [gif-compressor](https://github.com/your-repo/gif-compressor) for post-conversion optimization.

## Features

- **Drag & drop uploads** - Batch convert multiple files at once
- **Video support** - MP4, MOV, AVI, WebM
- **Image support** - PNG, JPG, TIFF, WebP
- **3-pass ffmpeg pipeline** - High-quality palette-based GIF encoding
- **Full conversion controls** - Dimensions, rotation, frame rates, backgrounds
- **Motion interpolation** - Smooth slow-motion effects
- **Background compositing** - Solid colors or custom images
- **Real-time progress** - WebSocket updates with per-pass tracking
- **Optional compression** - Integration with gif-compressor service
- **Bulk downloads** - Download multiple GIFs as ZIP

## Installation

### Prerequisites

- Docker and Docker Compose
- External Docker network (shared with other services)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-repo/gif-converter.git
   cd gif-converter
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   # Edit .env with your preferred settings
   ```

3. **Create the Docker network** (if it doesn't exist)
   ```bash
   docker network create vision_network
   ```

4. **Build and start the containers**
   ```bash
   docker compose up -d --build
   ```

5. **Access the application**
   ```
   http://localhost:5051
   ```

### Development Setup

For local development without Docker (requires Redis running on port 6379):

```bash
# Use Node.js 20
nvm use 20

# Install dependencies
npm install

# Start development server
npm run dev
```

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

### Conversion Pipeline

The converter uses a 3-pass ffmpeg pipeline for optimal GIF quality:

1. **Pass 1** - Convert input to intermediate MP4 with all filters applied (scale, rotate, interpolate)
2. **Pass 2** - Generate optimized color palette from the intermediate video
3. **Pass 3** - Create final GIF using the generated palette

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST_PORT` | `5051` | External port for the web UI |
| `COMPRESSOR_URL` | `http://gif-compressor:5050` | URL of gif-compressor service |
| `DEFAULT_CONCURRENCY` | `2` | Initial queue concurrency |
| `MAX_CONCURRENCY` | `10` | Maximum parallel conversions |
| `GIF_RETENTION_TTL` | _(empty)_ | Auto-cleanup in seconds (empty = disabled) |
| `DOCKER_NETWORK` | `vision_network` | Docker network name |

### Conversion Settings

| Setting | Type | Default | Description | Expected Values |
|---------|------|---------|-------------|-----------------|
| **Width** | number | _(auto)_ | Output width in pixels | `1` - `4096`, or empty for original |
| **Height** | number | _(auto)_ | Output height in pixels | `1` - `4096`, or empty for original |
| **Rotation** | select | None | Rotate the output | `None`, `90° CW`, `90° CCW`, `180°` |
| **Input FPS** | number | _(auto)_ | Override source frame rate | `1` - `120`, or empty for auto-detect |
| **Output FPS** | number | _(auto)_ | Target output frame rate | `1` - `50`, or empty for source rate |
| **Interpolate FPS** | number | _(off)_ | Motion interpolation target | `30` - `120`, or empty to disable |
| **Background Color** | string | _(none)_ | Fill color for transparent inputs | Hex (`#ffffff`) or color name (`white`) |
| **Background Image** | file | _(none)_ | Image to composite behind input | PNG, JPG, or other image file |
| **Compress Output** | boolean | `false` | Send to gif-compressor after conversion | `true` / `false` |

### Setting Guidelines

#### Dimensions
- Leave both empty to preserve original size
- Set only width or height to scale proportionally
- Aspect ratio is always preserved

#### Frame Rates
- **Input FPS**: Use for image sequences or to override incorrect metadata
- **Output FPS**: Lower values = smaller files (10-15 fps is common for GIFs)
- **Interpolate FPS**: Creates smooth slow-motion; significantly increases processing time

#### Background
- Use for transparent PNGs or WebP files
- Color takes precedence over image if both specified
- Background image is scaled to match output dimensions

## API Endpoints

### Upload & Download
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/upload` | Upload file(s) with conversion options |
| `GET` | `/api/download/:jobId` | Download converted GIF |
| `GET` | `/api/download/:jobId/original` | Download original file |
| `GET` | `/api/download/zip/archive?ids=a,b,c` | Download multiple as ZIP |

### Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/jobs` | List jobs (supports filtering) |
| `GET` | `/api/jobs/counts` | Get counts by status |
| `GET` | `/api/jobs/:id` | Get single job details |
| `DELETE` | `/api/jobs/:id` | Delete job and files |
| `POST` | `/api/jobs/:id/retry` | Retry failed job |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/queue/config` | Get queue concurrency |
| `PUT` | `/api/queue/config` | Set queue concurrency |

## CLI Script

A Python CLI script is provided for command-line conversions without using the web interface.

### Requirements

```bash
pip install requests
```

### Usage

```bash
# Basic conversion (downloads as {input}-converted.gif)
./scripts/convert.py video.mp4

# Save to specific file
./scripts/convert.py video.mp4 -o output.gif

# Just get download URL (no download)
./scripts/convert.py video.mp4 --url-only

# With resize and frame rate
./scripts/convert.py video.mp4 --width 320 --fps 15

# With rotation and compression
./scripts/convert.py video.mp4 --rotate 90 --compress

# With background color
./scripts/convert.py transparent.png --bg-color "#ffffff"

# Remote server
./scripts/convert.py video.mp4 --base-url http://server:5051
```

### CLI Options

| Option | Description |
|--------|-------------|
| `-o, --output` | Output file path (downloads the result) |
| `--url-only` | Print download URL instead of downloading |
| `--width` | Output width in pixels (auto if not set) |
| `--height` | Output height in pixels (auto if not set) |
| `--rotate` | Rotation in degrees: `0`, `90`, `180`, `270` |
| `--input-fps` | Override input frame rate |
| `--fps` | Output frame rate |
| `--interpolate` | Motion interpolation FPS (slow, for smooth slow-mo) |
| `--bg-color` | Background color (hex `#ffffff` or name `white`) |
| `--bg-image` | Background image file path |
| `--compress` | Send to gif-compressor after conversion |
| `--base-url` | API URL (default: `http://localhost:5051`) |
| `--no-progress` | Disable progress output |
| `--timeout` | Timeout in seconds (default: 300) |

## Project Structure

```
gif-converter/
├── docker-compose.yml
├── Dockerfile
├── package.json
├── .env.example
├── scripts/
│   └── convert.py        # CLI conversion script
├── server/
│   ├── index.ts           # Express server entry
│   ├── websocket.ts       # WebSocket handler
│   ├── types.ts           # TypeScript types
│   ├── db/
│   │   ├── schema.ts      # SQLite schema
│   │   └── client.ts      # Database client
│   ├── routes/
│   │   ├── upload.ts      # File upload
│   │   ├── jobs.ts        # Job management
│   │   ├── download.ts    # File downloads
│   │   └── queue.ts       # Queue config
│   └── services/
│       ├── conversion.ts  # ffmpeg 3-pass pipeline
│       ├── compressor.ts  # gif-compressor integration
│       ├── queue.ts       # Job queue
│       └── cleanup.ts     # TTL cleanup
└── src/
    ├── App.tsx
    ├── api/               # API client
    ├── components/        # React components
    ├── hooks/             # Custom hooks
    ├── store/             # Zustand stores
    └── pages/             # Page components
```

## License

MIT
