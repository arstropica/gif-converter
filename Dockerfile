# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install ffmpeg, curl for healthcheck, and runtime deps for better-sqlite3
RUN apk add --no-cache ffmpeg curl

# Copy package files and install production dependencies
COPY package*.json ./
RUN apk add --no-cache python3 make g++ && \
    npm install --omit=dev && \
    apk del python3 make g++

# Copy built assets from builder
COPY --from=builder /app/dist ./dist

# Create directories for uploads/output/data/temp
RUN mkdir -p /app/uploads /app/output /app/data /tmp/gif-converter

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5050
ENV UPLOAD_DIR=/app/uploads
ENV OUTPUT_DIR=/app/output
ENV DATABASE_PATH=/app/data/gif-converter.db
ENV TEMP_DIR=/tmp/gif-converter

# Volume for persistent data
VOLUME ["/app/uploads", "/app/output", "/app/data"]

EXPOSE 5050

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:5050/api/health || exit 1

CMD ["node", "dist/server/index.js"]
