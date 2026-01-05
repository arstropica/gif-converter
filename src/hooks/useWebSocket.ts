import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useCallback } from "react";

import type { WSMessage, JobStatusUpdate } from "@/api/types";
import { useJobStore } from "@/store/jobStore";

import { jobsKeys } from "./useJobs";

const WS_URL = `ws://${window.location.host}/ws`;
const RECONNECT_DELAY = 3000;
const PING_INTERVAL = 30000;

export function useWebSocket() {
  const queryClient = useQueryClient();
  const updateJobFromWS = useJobStore((state) => state.updateJobFromWS);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    console.log("[WebSocket] Connecting...");
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log("[WebSocket] Connected");

      // Start ping interval
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "PING" }));
        }
      }, PING_INTERVAL);
    };

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);

        switch (message.type) {
          case "CONNECTED":
            console.log("[WebSocket] Server confirmed connection");
            break;

          case "JOB_STATUS_UPDATE":
            if (message.jobId && message.data) {
              const update = message.data as JobStatusUpdate;

              // Update the job store directly for real-time progress
              updateJobFromWS(message.jobId, update);

              // Only invalidate queries for status changes (not progress updates)
              // This refreshes the full job data when status actually changes
              if (
                update.status === "completed" ||
                update.status === "failed" ||
                update.status === "queued"
              ) {
                queryClient.invalidateQueries({
                  queryKey: jobsKeys.detail(message.jobId),
                });
                queryClient.invalidateQueries({
                  queryKey: jobsKeys.lists(),
                });
                queryClient.invalidateQueries({
                  queryKey: jobsKeys.counts(),
                });
              }
            }
            break;

          case "QUEUE_UPDATE":
            queryClient.invalidateQueries({
              queryKey: jobsKeys.queue(),
            });
            break;

          case "PONG":
            // Heartbeat response, no action needed
            break;

          default:
            console.log("[WebSocket] Unknown message type:", message.type);
        }
      } catch (err) {
        console.error("[WebSocket] Error parsing message:", err);
      }
    };

    ws.onclose = () => {
      console.log("[WebSocket] Disconnected");
      wsRef.current = null;

      // Clear ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      // Reconnect after delay
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, RECONNECT_DELAY);
    };

    ws.onerror = (err) => {
      console.error("[WebSocket] Error:", err);
    };

    wsRef.current = ws;
  }, [queryClient, updateJobFromWS]);

  useEffect(() => {
    connect();

    return () => {
      // Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  };
}
