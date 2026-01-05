import cors from "cors";
import express from "express";
import fileUpload from "express-fileupload";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

import downloadRouter from "./routes/download.js";
import jobsRouter from "./routes/jobs.js";
import queueRouter from "./routes/queue.js";
import uploadRouter from "./routes/upload.js";
import { startCleanupScheduler } from "./services/cleanup.js";
import { setupWebSocket } from "./websocket.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || "5050", 10);
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "104857600", 10);

const app = express();
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(
  fileUpload({
    limits: { fileSize: MAX_FILE_SIZE },
    abortOnLimit: true,
    responseOnLimit: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
    useTempFiles: true,
    tempFileDir: "/tmp/",
    uploadTimeout: 0, // Disable timeout for large file uploads
    debug: process.env.NODE_ENV !== "production",
    limitHandler: (_req, res) => {
      console.error(
        `[Upload] File size limit exceeded. Max: ${MAX_FILE_SIZE / 1024 / 1024}MB`
      );
      res.status(413).json({
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      });
    },
  })
);

console.log(
  `[Server] MAX_FILE_SIZE configured to ${MAX_FILE_SIZE / 1024 / 1024}MB`
);

// Request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// API Routes
app.use("/api/upload", uploadRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/download", downloadRouter);
app.use("/api/queue", queueRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Serve static files in production
const clientPath = path.join(__dirname, "../client");
app.use(express.static(clientPath));

// SPA fallback
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientPath, "index.html"));
});

// Error handler
app.use(
  (
    err: Error & { status?: number; statusCode?: number },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[Server] Error:", err.message, err.stack);
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
      error: err.message || "Internal server error",
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    });
  }
);

// Setup WebSocket
setupWebSocket(server);

// Start cleanup scheduler
startCleanupScheduler();

// Start server
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    GIF Converter                          ║
║═══════════════════════════════════════════════════════════║
║  Server running on http://localhost:${PORT}                 ║
║  WebSocket available at ws://localhost:${PORT}/ws           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[Server] SIGTERM received, shutting down...");
  server.close(() => {
    console.log("[Server] Closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("[Server] SIGINT received, shutting down...");
  server.close(() => {
    console.log("[Server] Closed");
    process.exit(0);
  });
});
