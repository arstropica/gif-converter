export const SCHEMA_TABLE = `
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  status TEXT NOT NULL DEFAULT 'uploading',
  progress INTEGER NOT NULL DEFAULT 0,
  current_pass INTEGER NOT NULL DEFAULT 0,
  original_filename TEXT NOT NULL,
  original_size INTEGER NOT NULL,
  original_path TEXT,
  original_width INTEGER,
  original_height INTEGER,
  original_duration REAL,
  original_frame_count INTEGER,
  input_type TEXT NOT NULL DEFAULT 'video',
  options TEXT NOT NULL,
  background_image_path TEXT,
  converted_path TEXT,
  converted_size INTEGER,
  converted_width INTEGER,
  converted_height INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  expires_at TEXT,
  error_message TEXT
);
`;

export const SCHEMA_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_session_id ON jobs(session_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_expires_at ON jobs(expires_at);
CREATE INDEX IF NOT EXISTS idx_jobs_input_type ON jobs(input_type);
`;
