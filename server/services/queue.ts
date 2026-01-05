import Redis from "ioredis";
import PQueue from "p-queue";

import { convertToGif, getMediaInfo } from "./conversion.js";
import { compressGif, isCompressorAvailable } from "./compressor.js";
import * as db from "../db/client.js";
import type { JobStatus, JobStatusUpdate } from "../types.js";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379/0";
const DEFAULT_CONCURRENCY = parseInt(
  process.env.DEFAULT_CONCURRENCY || "2",
  10
);
const MAX_CONCURRENCY = parseInt(process.env.MAX_CONCURRENCY || "10", 10);
const GIF_RETENTION_TTL = process.env.GIF_RETENTION_TTL;

class ConversionQueue {
  private queue: PQueue;
  private redis: Redis;
  private concurrency: number;

  constructor(concurrency: number = DEFAULT_CONCURRENCY) {
    this.concurrency = Math.max(1, Math.min(MAX_CONCURRENCY, concurrency));
    this.queue = new PQueue({ concurrency: this.concurrency });
    this.redis = new Redis(REDIS_URL);

    this.redis.on("error", (err) => {
      console.error("[Queue] Redis error:", err.message);
    });

    console.log(`[Queue] Initialized with concurrency: ${this.concurrency}`);
  }

  async add(jobId: string): Promise<void> {
    console.log(`[Queue] Adding job: ${jobId}`);
    await this.queue.add(() => this.processJob(jobId));
    await this.publishQueueUpdate();
  }

  setConcurrency(value: number): void {
    const newConcurrency = Math.max(1, Math.min(MAX_CONCURRENCY, value));
    this.concurrency = newConcurrency;
    this.queue.concurrency = newConcurrency;
    console.log(`[Queue] Concurrency set to: ${newConcurrency}`);
    this.publishQueueUpdate();
  }

  getConcurrency(): number {
    return this.concurrency;
  }

  getStatus(): { concurrency: number; active: number; pending: number } {
    return {
      concurrency: this.concurrency,
      active: this.queue.pending, // Currently running
      pending: this.queue.size, // Waiting to run
    };
  }

  private async processJob(jobId: string): Promise<void> {
    console.log(`[Queue] Processing job: ${jobId}`);

    // Update status to processing
    const now = new Date().toISOString();
    db.updateJob(jobId, { status: "processing", started_at: now, current_pass: 1 });
    await this._publishUpdate(jobId, { status: "processing", progress: 0, current_pass: 1 });
    await this.publishQueueUpdate();

    try {
      const job = db.getJob(jobId);
      if (!job) {
        throw new Error("Job not found");
      }

      if (!job.original_path) {
        throw new Error("Job has no file to process");
      }

      // Get original media info
      const originalInfo = getMediaInfo(job.original_path);
      if (originalInfo.width > 0) {
        db.updateJob(jobId, {
          original_width: originalInfo.width,
          original_height: originalInfo.height,
          original_duration: originalInfo.duration ?? null,
          original_frame_count: originalInfo.frameCount ?? null,
        });
      }

      // Run 3-pass conversion
      const result = await convertToGif(
        job.original_path,
        job.options,
        job.background_image_path || null,
        async (progress, pass) => {
          // Scale conversion progress to 0-80% (leave 20% for optional compression)
          const scaledProgress = job.options.compress_output
            ? Math.round(progress * 0.8)
            : progress;

          db.updateJob(jobId, { progress: scaledProgress, current_pass: pass });
          await this._publishUpdate(jobId, {
            status: "processing",
            progress: scaledProgress,
            current_pass: pass,
          });
        }
      );

      let finalPath = result.path;
      let finalSize = result.size;

      // Optional: Send to gif-compressor
      if (job.options.compress_output) {
        console.log(`[Queue] Compressing output via gif-compressor...`);

        db.updateJob(jobId, { status: "compressing", progress: 80 });
        await this._publishUpdate(jobId, {
          status: "compressing",
          progress: 80,
        });

        const compressorAvailable = await isCompressorAvailable();

        if (compressorAvailable) {
          try {
            const compressResult = await compressGif(
              result.path,
              async (compressProgress) => {
                // Scale compression progress from 80-100%
                const overallProgress = 80 + Math.round(compressProgress * 0.2);
                db.updateJob(jobId, { progress: overallProgress });
                await this._publishUpdate(jobId, {
                  status: "compressing",
                  progress: overallProgress,
                });
              }
            );

            finalPath = compressResult.path;
            finalSize = compressResult.size;
          } catch (err) {
            console.error(`[Queue] Compression failed, using original:`, err);
            // Continue with uncompressed result
          }
        } else {
          console.log(`[Queue] gif-compressor not available, skipping compression`);
        }
      }

      // Calculate expiration if TTL is set
      let expiresAt: string | null = null;
      if (GIF_RETENTION_TTL) {
        const ttlSeconds = parseInt(GIF_RETENTION_TTL, 10);
        const expirationDate = new Date(Date.now() + ttlSeconds * 1000);
        expiresAt = expirationDate.toISOString();
      }

      // Update completion
      db.updateJob(jobId, {
        status: "completed",
        progress: 100,
        current_pass: 3,
        converted_path: finalPath,
        converted_size: finalSize,
        converted_width: result.width,
        converted_height: result.height,
        completed_at: new Date().toISOString(),
        expires_at: expiresAt,
      });

      await this._publishUpdate(jobId, {
        status: "completed",
        progress: 100,
        current_pass: 3,
        converted_size: finalSize,
        converted_width: result.width,
        converted_height: result.height,
      });

      console.log(`[Queue] Job completed: ${jobId} (${finalSize} bytes)`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[Queue] Job failed: ${jobId}`, errorMessage);

      db.updateJob(jobId, {
        status: "failed",
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      });

      await this._publishUpdate(jobId, {
        status: "failed",
        progress: 0,
        error_message: errorMessage,
      });
    }

    await this.publishQueueUpdate();
  }

  private async _publishUpdate(
    jobId: string,
    data: JobStatusUpdate
  ): Promise<void> {
    try {
      await this.redis.publish(`gif:job:${jobId}:status`, JSON.stringify(data));
    } catch (err) {
      console.error("[Queue] Failed to publish update:", err);
    }
  }

  private async publishQueueUpdate(): Promise<void> {
    try {
      const status = this.getStatus();
      await this.redis.publish("gif:queue:status", JSON.stringify(status));
    } catch (err) {
      console.error("[Queue] Failed to publish queue update:", err);
    }
  }

  async publishUpdate(jobId: string, data: JobStatusUpdate): Promise<void> {
    db.updateJob(jobId, { progress: data.progress || 0 });
    await this._publishUpdate(jobId, data);
  }

  async shutdown(): Promise<void> {
    this.queue.pause();
    this.queue.clear();
    await this.redis.quit();
  }
}

// Singleton instance
export const conversionQueue = new ConversionQueue();
