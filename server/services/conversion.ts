import { spawn, execSync } from "child_process";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

import type { ConversionOptions, ConvertResult, InputType } from "../types.js";

const OUTPUT_DIR = process.env.OUTPUT_DIR || "./output";
const TEMP_DIR = process.env.TEMP_DIR || "/tmp/gif-converter";

// Ensure directories exist
[OUTPUT_DIR, TEMP_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Supported input formats
export const SUPPORTED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".avi", ".webm"];
export const SUPPORTED_IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".tiff",
  ".tif",
  ".webp",
];
export const SUPPORTED_EXTENSIONS = [
  ...SUPPORTED_VIDEO_EXTENSIONS,
  ...SUPPORTED_IMAGE_EXTENSIONS,
];

export function getInputType(filename: string): InputType {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_VIDEO_EXTENSIONS.includes(ext) ? "video" : "image";
}

export function isSupported(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

export interface MediaInfo {
  width: number;
  height: number;
  duration?: number;
  frameCount?: number;
  fps?: number;
}

export function getMediaInfo(filePath: string): MediaInfo {
  try {
    // Use ffprobe to get media info
    const output = execSync(
      `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`,
      { encoding: "utf-8" }
    );

    const info = JSON.parse(output);
    const videoStream = info.streams?.find(
      (s: { codec_type: string }) => s.codec_type === "video"
    );

    let fps: number | undefined;
    if (videoStream?.r_frame_rate) {
      const [num, den] = videoStream.r_frame_rate.split("/").map(Number);
      fps = den ? num / den : num;
    }

    return {
      width: videoStream?.width || 0,
      height: videoStream?.height || 0,
      duration: info.format?.duration
        ? parseFloat(info.format.duration)
        : undefined,
      frameCount: videoStream?.nb_frames
        ? parseInt(videoStream.nb_frames, 10)
        : undefined,
      fps,
    };
  } catch (err) {
    console.error("[Conversion] Error getting media info:", err);
    return { width: 0, height: 0 };
  }
}

export async function convertToGif(
  inputPath: string,
  options: ConversionOptions,
  backgroundImagePath: string | null,
  onProgress?: (progress: number, pass: number) => void
): Promise<ConvertResult> {
  const jobId = uuidv4();
  const tempMp4 = path.join(TEMP_DIR, `${jobId}_temp.mp4`);
  const palettePath = path.join(TEMP_DIR, `${jobId}_palette.png`);
  const outputPath = path.join(OUTPUT_DIR, `${jobId}.gif`);

  console.log(`[Conversion] Starting conversion for ${inputPath}`);
  console.log(`[Conversion] Options:`, JSON.stringify(options, null, 2));

  try {
    // === PASS 1: Convert to temp MP4 with filters ===
    console.log(`[Conversion] Pass 1: Converting to temp MP4...`);
    onProgress?.(0, 1);
    await runPass1(
      inputPath,
      tempMp4,
      options,
      backgroundImagePath,
      (p) => {
        const overallProgress = Math.round(p * 0.33);
        onProgress?.(overallProgress, 1);
      }
    );
    console.log(`[Conversion] Pass 1 complete`);

    // === PASS 2: Generate palette ===
    console.log(`[Conversion] Pass 2: Generating palette...`);
    onProgress?.(33, 2);
    await runPass2(tempMp4, palettePath, (p) => {
      const overallProgress = 33 + Math.round(p * 0.33);
      onProgress?.(overallProgress, 2);
    });
    console.log(`[Conversion] Pass 2 complete`);

    // === PASS 3: Create GIF using palette ===
    console.log(`[Conversion] Pass 3: Creating GIF...`);
    onProgress?.(66, 3);
    const outputFps = calculateOutputFps(options);
    await runPass3(tempMp4, palettePath, outputPath, outputFps, (p) => {
      const overallProgress = 66 + Math.round(p * 0.34);
      onProgress?.(overallProgress, 3);
    });
    console.log(`[Conversion] Pass 3 complete`);

    // Get output info
    const stats = fs.statSync(outputPath);
    const info = getMediaInfo(outputPath);

    console.log(
      `[Conversion] Complete: ${outputPath} (${stats.size} bytes, ${info.width}x${info.height})`
    );

    return {
      path: outputPath,
      size: stats.size,
      width: info.width,
      height: info.height,
    };
  } finally {
    // Cleanup temp files
    [tempMp4, palettePath].forEach((f) => {
      if (fs.existsSync(f)) {
        try {
          fs.unlinkSync(f);
        } catch {
          // Ignore cleanup errors
        }
      }
    });
  }
}

async function runPass1(
  inputPath: string,
  outputPath: string,
  options: ConversionOptions,
  backgroundImagePath: string | null,
  onProgress: (progress: number) => void
): Promise<void> {
  const args: string[] = ["-y"];
  const vfFilters: string[] = [];
  let useFilterComplex = false;
  let filterComplexStr = "";
  let inputIndex = 0; // Track input index for filter_complex

  // Background color input
  if (options.background_color) {
    args.push("-f", "lavfi", "-i", `color=${options.background_color}`);
    useFilterComplex = true;
    inputIndex++;
  }
  // Background image input
  else if (backgroundImagePath && fs.existsSync(backgroundImagePath)) {
    args.push("-loop", "1", "-i", backgroundImagePath);
    useFilterComplex = true;
    inputIndex++;
  }

  // Input frame rate
  if (options.input_fps && options.input_fps > 0) {
    args.push("-r", String(options.input_fps));
  }

  // Main input
  args.push("-i", inputPath);

  // Build video filters
  if (
    (options.width && options.width > 0) ||
    (options.height && options.height > 0)
  ) {
    const w = options.width && options.width > 0 ? options.width : -2;
    const h = options.height && options.height > 0 ? options.height : -2;
    // Use -2 instead of -1 to ensure even dimensions for x264 compatibility
    vfFilters.push(`scale=${w}:${h}`);
  }

  if (options.transpose) {
    vfFilters.push(`transpose=${options.transpose}`);
  }

  if (options.minterpolate_fps && options.minterpolate_fps > 0) {
    vfFilters.push(
      `minterpolate='mi_mode=mci:mc_mode=aobmc:vsbmc=1:fps=${options.minterpolate_fps}'`
    );
  } else if (options.output_fps && options.output_fps > 0) {
    args.push("-r", String(options.output_fps));
  }

  // Build filter complex for background compositing
  if (useFilterComplex) {
    // Background is input 0, main video is input 1
    const bgOverlay = `[0][1]scale2ref[bg][gif];[bg]setsar=1[bg];[bg][gif]overlay=shortest=1`;
    if (vfFilters.length > 0) {
      filterComplexStr = `${bgOverlay},${vfFilters.join(",")}[out]`;
    } else {
      filterComplexStr = `${bgOverlay}[out]`;
    }
    args.push("-filter_complex", filterComplexStr, "-map", "[out]");
  } else if (vfFilters.length > 0) {
    args.push("-vf", vfFilters.join(","));
  }

  // Output encoding
  args.push("-c:v", "libx264", "-crf", "18", "-preset", "veryslow", "-an");
  args.push(outputPath);

  return runFfmpegWithProgress(args, onProgress);
}

async function runPass2(
  inputPath: string,
  palettePath: string,
  onProgress: (progress: number) => void
): Promise<void> {
  const args = [
    "-y",
    "-i",
    inputPath,
    "-filter_complex",
    "[0:v] palettegen",
    palettePath,
  ];
  return runFfmpegWithProgress(args, onProgress);
}

async function runPass3(
  inputPath: string,
  palettePath: string,
  outputPath: string,
  fps: number,
  onProgress: (progress: number) => void
): Promise<void> {
  const args = [
    "-y",
    "-i",
    inputPath,
    "-i",
    palettePath,
    "-filter_complex",
    "[0:v][1:v] paletteuse",
    "-r",
    String(fps),
    outputPath,
  ];
  return runFfmpegWithProgress(args, onProgress);
}

function calculateOutputFps(options: ConversionOptions): number {
  // Priority: minterpolate > output > input > default
  // Cap at 50 FPS to avoid excessively large GIFs
  if (options.minterpolate_fps && options.minterpolate_fps > 0) {
    return Math.min(options.minterpolate_fps, 50);
  }
  if (options.output_fps && options.output_fps > 0) {
    return Math.min(options.output_fps, 50);
  }
  if (options.input_fps && options.input_fps > 0) {
    return Math.min(options.input_fps, 50);
  }
  return 30; // Default
}

async function runFfmpegWithProgress(
  args: string[],
  onProgress: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`[Conversion] Running: ffmpeg ${args.join(" ")}`);

    const proc = spawn("ffmpeg", args, { stdio: ["pipe", "pipe", "pipe"] });

    let duration = 0;
    let stderr = "";

    proc.stderr.on("data", (data) => {
      const chunk = data.toString();
      stderr += chunk;

      // Parse duration from initial output
      const durationMatch = stderr.match(/Duration: (\d+):(\d+):(\d+\.?\d*)/);
      if (durationMatch && duration === 0) {
        duration =
          parseInt(durationMatch[1], 10) * 3600 +
          parseInt(durationMatch[2], 10) * 60 +
          parseFloat(durationMatch[3]);
      }

      // Parse current time for progress
      const timeMatch = chunk.match(/time=(\d+):(\d+):(\d+\.?\d*)/);
      if (timeMatch && duration > 0) {
        const currentTime =
          parseInt(timeMatch[1], 10) * 3600 +
          parseInt(timeMatch[2], 10) * 60 +
          parseFloat(timeMatch[3]);
        const progress = Math.min(100, (currentTime / duration) * 100);
        onProgress(progress);
      }
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        const errorSummary = stderr.slice(-500);
        reject(new Error(`ffmpeg failed with code ${code}: ${errorSummary}`));
      } else {
        onProgress(100);
        resolve();
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn ffmpeg: ${err.message}`));
    });
  });
}
