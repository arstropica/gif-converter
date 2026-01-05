export type JobStatus =
  | "uploading"
  | "queued"
  | "processing"
  | "compressing"
  | "completed"
  | "failed";

export type InputType = "video" | "image";

export type TransposeValue = 0 | 1 | 2 | 3;

export interface ConversionOptions {
  width: number | null;
  height: number | null;
  transpose: TransposeValue;
  input_fps: number | null;
  output_fps: number | null;
  minterpolate_fps: number | null;
  background_color: string | null;
  background_image_id: string | null;
  compress_output: boolean;
}

export const DEFAULT_CONVERSION_OPTIONS: ConversionOptions = {
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

export interface Job {
  id: string;
  session_id?: string;
  status: JobStatus;
  progress: number;
  current_pass: number;
  original_filename: string;
  original_size: number;
  original_width?: number;
  original_height?: number;
  original_duration?: number;
  original_frame_count?: number;
  input_type: InputType;
  options: ConversionOptions;
  background_image_path?: string;
  converted_size?: number;
  converted_width?: number;
  converted_height?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  expires_at?: string;
  error_message?: string;
}

export interface JobFilters {
  status?: JobStatus | JobStatus[] | "all";
  session_id?: string;
  filename?: string;
  input_type?: InputType;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface ListJobsResponse {
  jobs: Job[];
  total: number;
  limit: number;
  offset: number;
}

export interface JobCounts {
  all: number;
  uploading: number;
  queued: number;
  processing: number;
  compressing: number;
  completed: number;
  failed: number;
}

export interface QueueConfig {
  concurrency: number;
  active: number;
  pending: number;
}

export interface UploadResponse {
  jobs: Array<{
    id: string;
    filename: string;
  }>;
}

export interface BatchCreateRequest {
  files: Array<{
    filename: string;
    size: number;
    options: ConversionOptions;
    inputType?: InputType;
  }>;
  sessionId: string;
}

export interface BatchCreateResponse {
  jobs: Array<{
    id: string;
    filename: string;
  }>;
  sessionId: string;
}

export interface WSMessage {
  type: "CONNECTED" | "JOB_STATUS_UPDATE" | "QUEUE_UPDATE" | "PONG";
  jobId?: string;
  data?: JobStatusUpdate | QueueConfig;
}

export interface JobStatusUpdate {
  status: JobStatus;
  progress: number;
  current_pass?: number;
  converted_size?: number;
  converted_width?: number;
  converted_height?: number;
  error_message?: string;
}
