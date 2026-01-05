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

export interface Job {
  id: string;
  session_id?: string;
  status: JobStatus;
  progress: number;
  current_pass: number;
  original_filename: string;
  original_size: number;
  original_path?: string;
  original_width?: number;
  original_height?: number;
  original_duration?: number;
  original_frame_count?: number;
  input_type: InputType;
  options: ConversionOptions;
  background_image_path?: string;
  converted_path?: string;
  converted_size?: number;
  converted_width?: number;
  converted_height?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  expires_at?: string;
  error_message?: string;
}

export interface JobRow {
  id: string;
  session_id: string | null;
  status: string;
  progress: number;
  current_pass: number;
  original_filename: string;
  original_size: number;
  original_path: string | null;
  original_width: number | null;
  original_height: number | null;
  original_duration: number | null;
  original_frame_count: number | null;
  input_type: string;
  options: string; // JSON string
  background_image_path: string | null;
  converted_path: string | null;
  converted_size: number | null;
  converted_width: number | null;
  converted_height: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  error_message: string | null;
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

export interface ConvertResult {
  path: string;
  size: number;
  width: number;
  height: number;
}

export interface WSMessage {
  type: "CONNECTED" | "JOB_STATUS_UPDATE" | "QUEUE_UPDATE" | "PONG";
  jobId?: string;
  data?: unknown;
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
