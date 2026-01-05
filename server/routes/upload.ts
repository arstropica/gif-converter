import { Router } from "express";
import type { Request, Response } from "express";
import type { UploadedFile } from "express-fileupload";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

import * as db from "../db/client.js";
import { getMediaInfo, getInputType, isSupported } from "../services/conversion.js";
import { conversionQueue } from "../services/queue.js";
import type { ConversionOptions } from "../types.js";

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

router.post("/", async (req: Request, res: Response) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    // Parse options from request body
    let globalOptions: ConversionOptions = DEFAULT_OPTIONS;
    if (req.body.options) {
      try {
        globalOptions = { ...DEFAULT_OPTIONS, ...JSON.parse(req.body.options) };
      } catch {
        console.warn("[Upload] Invalid options JSON, using defaults");
      }
    }

    // Parse per-file options if provided
    let perFileOptions: Record<string, ConversionOptions> = {};
    if (req.body.perFileOptions) {
      try {
        perFileOptions = JSON.parse(req.body.perFileOptions);
      } catch {
        console.warn("[Upload] Invalid perFileOptions JSON");
      }
    }

    // Handle single or multiple files
    const files = Array.isArray(req.files.files)
      ? req.files.files
      : [req.files.files as UploadedFile];

    // Handle optional background image
    let backgroundImagePath: string | null = null;
    if (req.files.background) {
      const bgFile = req.files.background as UploadedFile;
      const bgId = uuidv4();
      backgroundImagePath = path.join(UPLOAD_DIR, `${bgId}_bg${path.extname(bgFile.name)}`);
      await bgFile.mv(backgroundImagePath);
      console.log(`[Upload] Saved background image: ${backgroundImagePath}`);
    }

    const createdJobs: Array<{ id: string; filename: string }> = [];
    const errors: Array<{ filename: string; error: string }> = [];

    for (const file of files) {
      // Validate file type
      if (!SUPPORTED_MIMETYPES.includes(file.mimetype) && !isSupported(file.name)) {
        errors.push({ filename: file.name, error: "Unsupported file format" });
        continue;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push({
          filename: file.name,
          error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
        });
        continue;
      }

      const jobId = uuidv4();
      const ext = path.extname(file.name);
      const uploadPath = path.join(UPLOAD_DIR, `${jobId}${ext}`);

      try {
        // Move file to upload directory
        await file.mv(uploadPath);

        // Get media info
        const info = getMediaInfo(uploadPath);
        const inputType = getInputType(file.name);

        // Use per-file options if provided, otherwise use global options
        const options = perFileOptions[file.name] || globalOptions;

        // Create job in database
        const job = db.createJob({
          id: jobId,
          filename: file.name,
          size: file.size,
          filePath: uploadPath,
          options,
          inputType,
          backgroundImagePath: backgroundImagePath ?? undefined,
          width: info.width,
          height: info.height,
          duration: info.duration,
          frameCount: info.frameCount,
        });

        // Add to conversion queue
        await conversionQueue.add(jobId);

        createdJobs.push({ id: job.id, filename: file.name });
        console.log(`[Upload] Created job ${jobId} for ${file.name} (${inputType})`);
      } catch (err) {
        console.error(`[Upload] Failed to process ${file.name}:`, err);
        errors.push({
          filename: file.name,
          error: err instanceof Error ? err.message : "Upload failed",
        });

        // Clean up uploaded file on error
        if (fs.existsSync(uploadPath)) {
          fs.unlinkSync(uploadPath);
        }
      }
    }

    if (createdJobs.length === 0 && errors.length > 0) {
      // Clean up background image if all uploads failed
      if (backgroundImagePath && fs.existsSync(backgroundImagePath)) {
        fs.unlinkSync(backgroundImagePath);
      }
      return res
        .status(400)
        .json({ error: "All uploads failed", details: errors });
    }

    res.status(201).json({
      jobs: createdJobs,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("[Upload] Error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
