import { Router } from "express";
import type { Request, Response } from "express";
import type { UploadedFile } from "express-fileupload";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

import * as db from "../db/client.js";
import { cleanupJobFiles } from "../services/cleanup.js";
import { getMediaInfo, getInputType, isSupported } from "../services/conversion.js";
import { conversionQueue } from "../services/queue.js";
import type { JobFilters, ConversionOptions, InputType } from "../types.js";

const router = Router();
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "104857600", 10);

// Supported MIME types
const SUPPORTED_MIMETYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
  "image/png",
  "image/jpeg",
  "image/tiff",
  "image/webp",
];

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

interface BatchCreateRequest {
  files: Array<{
    filename: string;
    size: number;
    options: ConversionOptions;
    inputType?: InputType;
  }>;
  sessionId: string;
}

// Upload file to existing job
router.put("/:id/upload", async (req: Request, res: Response) => {
  try {
    const jobId = req.params.id;
    const job = db.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (job.status !== "uploading") {
      return res.status(400).json({ error: "Job is not in uploading state" });
    }

    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const file = req.files.file as UploadedFile;

    // Validate file type
    if (!SUPPORTED_MIMETYPES.includes(file.mimetype) && !isSupported(file.name)) {
      return res.status(400).json({ error: "Unsupported file format" });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({
        error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
      });
    }

    const ext = path.extname(file.name);
    const uploadPath = path.join(UPLOAD_DIR, `${jobId}${ext}`);

    // Move file to upload directory
    await file.mv(uploadPath);

    // Get media info
    const info = getMediaInfo(uploadPath);
    const inputType = getInputType(file.name);

    // Update job with file info
    db.updateJob(jobId, {
      status: "uploading",
      original_path: uploadPath,
      original_width: info.width,
      original_height: info.height,
      original_duration: info.duration ?? null,
      original_frame_count: info.frameCount ?? null,
      input_type: inputType,
    });

    // Publish status update via Redis
    await conversionQueue.publishUpdate(jobId, {
      status: "uploading",
      progress: 100,
    });

    // Add to conversion queue
    await conversionQueue.add(jobId);

    const updatedJob = db.getJob(jobId);
    console.log(`[Jobs] Upload complete for job ${jobId}, added to queue`);

    res.json(updatedJob);
  } catch (err) {
    console.error("[Jobs] Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// Create multiple jobs before upload (batch provisioning)
router.post("/batch", (req: Request, res: Response) => {
  try {
    const { files, sessionId } = req.body as BatchCreateRequest;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: "No files specified" });
    }

    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    const createdJobs: Array<{ id: string; filename: string }> = [];

    for (const file of files) {
      if (!file.filename || !file.size || !file.options) {
        continue;
      }

      const jobId = uuidv4();
      const inputType = file.inputType || getInputType(file.filename);

      // Create job in "uploading" status (default) without file path
      db.createJob({
        id: jobId,
        filename: file.filename,
        size: file.size,
        options: file.options,
        inputType,
        sessionId,
      });

      createdJobs.push({ id: jobId, filename: file.filename });
      console.log(`[Jobs] Created batch job ${jobId} for ${file.filename}`);
    }

    if (createdJobs.length === 0) {
      return res.status(400).json({ error: "No valid files to process" });
    }

    res.status(201).json({
      jobs: createdJobs,
      sessionId,
    });
  } catch (err) {
    console.error("[Jobs] Batch create error:", err);
    res.status(500).json({ error: "Failed to create jobs" });
  }
});

// List jobs with filters
router.get("/", (req: Request, res: Response) => {
  try {
    // Parse status - can be single value, comma-separated, or "all"
    let status: JobFilters["status"] = undefined;
    if (req.query.status) {
      const statusStr = req.query.status as string;
      if (statusStr === "all") {
        status = "all";
      } else if (statusStr.includes(",")) {
        status = statusStr.split(",") as JobFilters["status"];
      } else {
        status = statusStr as JobFilters["status"];
      }
    }

    const filters: JobFilters = {
      status,
      session_id: req.query.session_id as string,
      filename: req.query.filename as string,
      input_type: req.query.input_type as InputType,
      start_date: req.query.start_date as string,
      end_date: req.query.end_date as string,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    };

    const { jobs, total } = db.listJobs(filters);

    res.json({
      jobs,
      total,
      limit: filters.limit,
      offset: filters.offset,
    });
  } catch (err) {
    console.error("[Jobs] List error:", err);
    res.status(500).json({ error: "Failed to list jobs" });
  }
});

// Get job counts by status
router.get("/counts", (_req: Request, res: Response) => {
  try {
    const counts = db.getJobCounts();
    res.json(counts);
  } catch (err) {
    console.error("[Jobs] Counts error:", err);
    res.status(500).json({ error: "Failed to get job counts" });
  }
});

// Get single job
router.get("/:id", (req: Request, res: Response) => {
  try {
    const job = db.getJob(req.params.id);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    res.json(job);
  } catch (err) {
    console.error("[Jobs] Get error:", err);
    res.status(500).json({ error: "Failed to get job" });
  }
});

// Delete job
router.delete("/:id", (req: Request, res: Response) => {
  try {
    const job = db.getJob(req.params.id);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Clean up files
    cleanupJobFiles(req.params.id);

    // Delete from database
    const deleted = db.deleteJob(req.params.id);

    if (deleted) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: "Failed to delete job" });
    }
  } catch (err) {
    console.error("[Jobs] Delete error:", err);
    res.status(500).json({ error: "Failed to delete job" });
  }
});

// Retry failed job
router.post("/:id/retry", async (req: Request, res: Response) => {
  try {
    const job = db.getJob(req.params.id);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (job.status !== "failed") {
      return res.status(400).json({ error: "Only failed jobs can be retried" });
    }

    // Reset job status
    db.updateJob(req.params.id, {
      status: "queued",
      progress: 0,
      current_pass: 0,
      error_message: null,
      started_at: null,
      completed_at: null,
      converted_path: null,
      converted_size: null,
    });

    // Re-add to queue
    await conversionQueue.add(req.params.id);

    const updatedJob = db.getJob(req.params.id);
    res.json(updatedJob);
  } catch (err) {
    console.error("[Jobs] Retry error:", err);
    res.status(500).json({ error: "Failed to retry job" });
  }
});

export default router;
