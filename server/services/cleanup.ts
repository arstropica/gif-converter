import fs from "fs";
import cron from "node-cron";

import * as db from "../db/client.js";

const GIF_RETENTION_TTL = process.env.GIF_RETENTION_TTL;

export function startCleanupScheduler(): void {
  if (!GIF_RETENTION_TTL) {
    console.log("[Cleanup] No TTL configured, cleanup scheduler disabled");
    return;
  }

  console.log(`[Cleanup] Starting scheduler with TTL: ${GIF_RETENTION_TTL}s`);

  // Run cleanup every hour
  cron.schedule("0 * * * *", async () => {
    console.log("[Cleanup] Starting scheduled cleanup...");
    await runCleanup();
  });

  // Also run once at startup after a short delay
  setTimeout(runCleanup, 5000);
}

export async function runCleanup(): Promise<number> {
  const expiredJobs = db.getExpiredJobs();

  if (expiredJobs.length === 0) {
    console.log("[Cleanup] No expired jobs found");
    return 0;
  }

  let deletedCount = 0;

  for (const job of expiredJobs) {
    try {
      // Delete original file
      if (job.original_path && fs.existsSync(job.original_path)) {
        fs.unlinkSync(job.original_path);
        console.log(`[Cleanup] Deleted original: ${job.original_path}`);
      }

      // Delete background image file
      if (job.background_image_path && fs.existsSync(job.background_image_path)) {
        fs.unlinkSync(job.background_image_path);
        console.log(`[Cleanup] Deleted background: ${job.background_image_path}`);
      }

      // Delete converted file
      if (job.converted_path && fs.existsSync(job.converted_path)) {
        fs.unlinkSync(job.converted_path);
        console.log(`[Cleanup] Deleted converted: ${job.converted_path}`);
      }

      // Delete database record
      db.deleteJob(job.id);
      deletedCount++;

      console.log(`[Cleanup] Removed expired job: ${job.id}`);
    } catch (err) {
      console.error(`[Cleanup] Error deleting job ${job.id}:`, err);
    }
  }

  console.log(`[Cleanup] Removed ${deletedCount} expired jobs`);
  return deletedCount;
}

export function cleanupJobFiles(jobId: string): boolean {
  const job = db.getJob(jobId);
  if (!job) return false;

  try {
    if (job.original_path && fs.existsSync(job.original_path)) {
      fs.unlinkSync(job.original_path);
    }
    if (job.background_image_path && fs.existsSync(job.background_image_path)) {
      fs.unlinkSync(job.background_image_path);
    }
    if (job.converted_path && fs.existsSync(job.converted_path)) {
      fs.unlinkSync(job.converted_path);
    }
    return true;
  } catch (err) {
    console.error(`[Cleanup] Error cleaning up job ${jobId}:`, err);
    return false;
  }
}
