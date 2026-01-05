import type {
  Job,
  JobFilters,
  ListJobsResponse,
  JobCounts,
  QueueConfig,
  UploadResponse,
  ConversionOptions,
  BatchCreateRequest,
  BatchCreateResponse,
  InputType,
} from "./types";

const API_BASE = "/api";

class ApiError extends Error {
  public status: number;
  public data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let data;
    try {
      data = await response.json();
    } catch {
      data = { message: response.statusText };
    }
    throw new ApiError(
      data.error || data.message || `API Error: ${response.status}`,
      response.status,
      data
    );
  }

  return response.json();
}

// Jobs API
export async function listJobs(
  filters: JobFilters = {}
): Promise<ListJobsResponse> {
  const params = new URLSearchParams();

  if (filters.status && filters.status !== "all") {
    if (Array.isArray(filters.status)) {
      params.set("status", filters.status.join(","));
    } else {
      params.set("status", filters.status);
    }
  }
  if (filters.session_id) params.set("session_id", filters.session_id);
  if (filters.filename) params.set("filename", filters.filename);
  if (filters.input_type) params.set("input_type", filters.input_type);
  if (filters.start_date) params.set("start_date", filters.start_date);
  if (filters.end_date) params.set("end_date", filters.end_date);
  if (filters.offset) params.set("offset", String(filters.offset));
  if (filters.limit && filters.limit > 0) {
    params.set("limit", String(filters.limit));
  }

  const query = params.toString();
  return fetchApi<ListJobsResponse>(`/jobs${query ? `?${query}` : ""}`);
}

export async function getJob(id: string): Promise<Job> {
  return fetchApi<Job>(`/jobs/${id}`);
}

export async function deleteJob(id: string): Promise<void> {
  await fetchApi(`/jobs/${id}`, { method: "DELETE" });
}

export async function retryJob(id: string): Promise<Job> {
  return fetchApi<Job>(`/jobs/${id}/retry`, { method: "POST" });
}

export async function getJobCounts(): Promise<JobCounts> {
  return fetchApi<JobCounts>("/jobs/counts");
}

// Batch create jobs before upload
export async function createJobsBatch(
  request: BatchCreateRequest
): Promise<BatchCreateResponse> {
  return fetchApi<BatchCreateResponse>("/jobs/batch", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

// Upload single file to existing job with progress callback
export async function uploadJobFile(
  jobId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<Job> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        const progress = Math.round((e.loaded / e.total) * 100);
        onProgress(progress);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const job = JSON.parse(xhr.responseText);
          resolve(job);
        } catch {
          reject(new ApiError("Invalid response", xhr.status));
        }
      } else {
        let error = "Upload failed";
        try {
          const data = JSON.parse(xhr.responseText);
          error = data.error || error;
        } catch {
          // ignore parse errors
        }
        reject(new ApiError(error, xhr.status));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new ApiError("Network error", 0));
    });

    xhr.addEventListener("abort", () => {
      reject(new ApiError("Upload aborted", 0));
    });

    xhr.open("PUT", `${API_BASE}/jobs/${jobId}/upload`);

    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}

// Upload API (direct upload with options)
export async function uploadFiles(
  files: File[],
  globalOptions: ConversionOptions,
  perFileOptions?: Record<string, ConversionOptions>,
  backgroundImage?: File
): Promise<UploadResponse> {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("files", file);
  });

  formData.append("options", JSON.stringify(globalOptions));

  if (perFileOptions && Object.keys(perFileOptions).length > 0) {
    formData.append("perFileOptions", JSON.stringify(perFileOptions));
  }

  if (backgroundImage) {
    formData.append("background", backgroundImage);
  }

  const response = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const data = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new ApiError(data.error || "Upload failed", response.status, data);
  }

  return response.json();
}

// Queue API
export async function getQueueConfig(): Promise<QueueConfig> {
  return fetchApi<QueueConfig>("/queue/config");
}

export async function setQueueConcurrency(
  concurrency: number
): Promise<QueueConfig> {
  return fetchApi<QueueConfig>("/queue/config", {
    method: "PUT",
    body: JSON.stringify({ concurrency }),
  });
}

// Download URLs
export function getDownloadUrl(jobId: string): string {
  return `${API_BASE}/download/${jobId}`;
}

export function getOriginalUrl(jobId: string): string {
  return `${API_BASE}/download/${jobId}/original`;
}

export function getThumbnailUrl(jobId: string): string {
  return `${API_BASE}/download/${jobId}/thumbnail`;
}

export function getZipDownloadUrl(jobIds: string[]): string {
  return `${API_BASE}/download/zip/archive?ids=${jobIds.join(",")}`;
}

// Input type detection
export function getInputTypeFromFile(file: File): InputType {
  const videoTypes = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"];
  return videoTypes.includes(file.type) ? "video" : "image";
}

export { ApiError };
