import type { Server } from "http";
import Redis from "ioredis";
import { WebSocketServer, WebSocket } from "ws";

import type { WSMessage } from "./types.js";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379/0";

export function setupWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const clients = new Set<WebSocket>();

  // Redis subscriber for job updates
  const subscriber = new Redis(REDIS_URL);

  subscriber.on("error", (err) => {
    console.error("[WebSocket] Redis subscriber error:", err.message);
  });

  subscriber.on("connect", () => {
    console.log("[WebSocket] Redis subscriber connected");
  });

  // Subscribe to job status updates and queue updates
  subscriber.psubscribe("gif:job:*:status", "gif:queue:status");

  subscriber.on("pmessage", (_pattern, channel, message) => {
    try {
      if (channel === "gif:queue:status") {
        // Queue status update
        const data = JSON.parse(message);
        broadcast({
          type: "QUEUE_UPDATE",
          data,
        });
      } else if (channel.startsWith("gif:job:")) {
        // Job status update
        const parts = channel.split(":");
        const jobId = parts[2];
        const data = JSON.parse(message);

        broadcast({
          type: "JOB_STATUS_UPDATE",
          jobId,
          data,
        });
      }
    } catch (err) {
      console.error("[WebSocket] Error processing message:", err);
    }
  });

  function broadcast(message: WSMessage): void {
    const payload = JSON.stringify(message);
    let sent = 0;

    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
        sent++;
      }
    });

    if (sent > 0) {
      console.log(`[WebSocket] Broadcast ${message.type} to ${sent} clients`);
    }
  }

  wss.on("connection", (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`[WebSocket] Client connected: ${clientIp}`);

    clients.add(ws);

    // Send connected message
    ws.send(JSON.stringify({ type: "CONNECTED" }));

    // Handle incoming messages
    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === "PING") {
          ws.send(JSON.stringify({ type: "PONG" }));
        }
      } catch (err) {
        console.error("[WebSocket] Error parsing message:", err);
      }
    });

    // Handle disconnect
    ws.on("close", () => {
      console.log(`[WebSocket] Client disconnected: ${clientIp}`);
      clients.delete(ws);
    });

    // Handle errors
    ws.on("error", (err) => {
      console.error(`[WebSocket] Client error: ${clientIp}`, err);
      clients.delete(ws);
    });
  });

  // Heartbeat to keep connections alive
  const heartbeatInterval = setInterval(() => {
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.ping();
      }
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
    subscriber.quit();
  });

  console.log("[WebSocket] Server initialized");
}
