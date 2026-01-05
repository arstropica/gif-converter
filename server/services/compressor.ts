import fs from "fs";
import path from "path";
import FormData from "form-data";

const COMPRESSOR_URL =
  process.env.COMPRESSOR_URL || "http://gif-compressor:5050";
const OUTPUT_DIR = process.env.OUTPUT_DIR || "./output";

interface CompressorResult {
  path: string;
  size: number;
}

interface CompressorJob {
  id: string;
  status: string;
  progress: number;
  compressed_path?: string;
  compressed_size?: number;
  error_message?: string;
}

export async function isCompressorAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${COMPRESSOR_URL}/api/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function compressGif(
  gifPath: string,
  onProgress?: (progress: number) => void
): Promise<CompressorResult> {
  console.log(`[Compressor] Sending ${gifPath} to gif-compressor...`);

  // Check if compressor is available
  const available = await isCompressorAvailable();
  if (!available) {
    throw new Error("gif-compressor service is not available");
  }

  // Create form data with the GIF file
  const formData = new FormData();
  formData.append("files", fs.createReadStream(gifPath), {
    filename: path.basename(gifPath),
    contentType: "image/gif",
  });

  // Default compression options
  formData.append("compression_level", "75");
  formData.append("optimize_transparency", "true");

  // Upload to compressor
  const uploadResponse = await fetch(`${COMPRESSOR_URL}/api/upload`, {
    method: "POST",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: formData as any,
    headers: formData.getHeaders(),
  });

  if (!uploadResponse.ok) {
    const error = await uploadResponse.text();
    throw new Error(`Failed to upload to compressor: ${error}`);
  }

  const uploadResult = (await uploadResponse.json()) as { jobs: { id: string }[] };
  const jobId = uploadResult.jobs?.[0]?.id;

  if (!jobId) {
    throw new Error("No job ID returned from compressor");
  }

  console.log(`[Compressor] Job created: ${jobId}`);

  // Poll for completion
  const result = await pollCompressorJob(jobId, onProgress);

  // Download the compressed file
  const downloadResponse = await fetch(
    `${COMPRESSOR_URL}/api/download/${jobId}`
  );
  if (!downloadResponse.ok) {
    throw new Error("Failed to download compressed file");
  }

  // Save to output directory with new name
  const compressedPath = gifPath.replace(".gif", "-compressed.gif");
  const buffer = Buffer.from(await downloadResponse.arrayBuffer());
  fs.writeFileSync(compressedPath, buffer);

  console.log(
    `[Compressor] Compression complete: ${compressedPath} (${result.size} bytes)`
  );

  return {
    path: compressedPath,
    size: result.size,
  };
}

async function pollCompressorJob(
  jobId: string,
  onProgress?: (progress: number) => void
): Promise<{ size: number }> {
  const maxAttempts = 120; // 2 minutes max
  const pollInterval = 1000; // 1 second

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(`${COMPRESSOR_URL}/api/jobs/${jobId}`);

    if (!response.ok) {
      throw new Error(`Failed to get job status: ${response.statusText}`);
    }

    const job = (await response.json()) as CompressorJob;

    onProgress?.(job.progress || 0);

    if (job.status === "completed") {
      return {
        size: job.compressed_size || 0,
      };
    }

    if (job.status === "failed") {
      throw new Error(`Compression failed: ${job.error_message || "Unknown error"}`);
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error("Compression timed out");
}
