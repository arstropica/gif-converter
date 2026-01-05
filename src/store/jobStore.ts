import { v4 as uuidv4 } from "uuid";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { deleteJob, listJobs } from "@/api/client";
import type { Job, JobStatus, JobStatusUpdate, InputType } from "@/api/types";

export interface JobState {
  id: string;
  status: JobStatus;
  progress: number;
  current_pass: number;
  original_filename: string;
  original_size: number;
  original_width?: number;
  original_height?: number;
  input_type: InputType;
  converted_size?: number;
  converted_width?: number;
  converted_height?: number;
  error_message?: string;
  // Client-side tracking for upload progress (0-100 of upload phase)
  uploadProgress?: number;
}

interface JobStore {
  // Job state map (jobId -> JobState)
  jobs: Record<string, JobState>;

  // Current session ID
  sessionId: string | null;

  // Whether session has been initialized (prevents repeated GC)
  initialized: boolean;

  // Actions
  setJob: (jobId: string, state: JobState) => void;
  setJobs: (jobs: Job[]) => void;
  updateJob: (jobId: string, update: Partial<JobState>) => void;
  updateJobFromWS: (jobId: string, update: JobStatusUpdate) => void;
  removeJob: (jobId: string) => void;
  clearJobs: () => void;

  // Session management
  initSessionAsync: () => Promise<string>;

  // Helpers
  hasActiveJobs: () => boolean;
  getActiveJobIds: () => string[];
}

export const useJobStore = create<JobStore>()(
  persist(
    (set, get) => ({
      jobs: {},
      sessionId: null,
      initialized: false,

      setJob: (jobId, state) =>
        set((s) => ({
          jobs: { ...s.jobs, [jobId]: state },
        })),

      setJobs: (jobs) =>
        set((s) => {
          const newJobs = { ...s.jobs };
          for (const job of jobs) {
            newJobs[job.id] = {
              id: job.id,
              status: job.status,
              progress: job.progress,
              current_pass: job.current_pass,
              original_filename: job.original_filename,
              original_size: job.original_size,
              original_width: job.original_width,
              original_height: job.original_height,
              input_type: job.input_type,
              converted_size: job.converted_size,
              converted_width: job.converted_width,
              converted_height: job.converted_height,
              error_message: job.error_message,
            };
          }
          return { jobs: newJobs };
        }),

      updateJob: (jobId, update) =>
        set((s) => {
          const existingJob = s.jobs[jobId];
          if (!existingJob) return s;
          return {
            jobs: {
              ...s.jobs,
              [jobId]: { ...existingJob, ...update },
            },
          };
        }),

      updateJobFromWS: (jobId, update) =>
        set((s) => {
          const existingJob = s.jobs[jobId];
          if (!existingJob) return s;
          return {
            jobs: {
              ...s.jobs,
              [jobId]: {
                ...existingJob,
                status: update.status,
                progress: update.progress,
                current_pass: update.current_pass ?? existingJob.current_pass,
                converted_size:
                  update.converted_size ?? existingJob.converted_size,
                converted_width:
                  update.converted_width ?? existingJob.converted_width,
                converted_height:
                  update.converted_height ?? existingJob.converted_height,
                error_message:
                  update.error_message ?? existingJob.error_message,
              },
            },
          };
        }),

      removeJob: (jobId) =>
        set((s) => {
          const { [jobId]: _, ...rest } = s.jobs;
          return { jobs: rest };
        }),

      clearJobs: () => set({ jobs: {} }),

      initSessionAsync: async () => {
        const state = get();

        // Only run initialization once per app lifecycle
        if (state.initialized) {
          return state.sessionId!;
        }

        // If we have a persisted session, check server for active jobs
        if (state.sessionId) {
          try {
            const { jobs } = await listJobs({
              session_id: state.sessionId,
              status: ["uploading", "queued", "processing", "compressing"],
            });

            // Separate stale jobs from active processing jobs
            const staleJobs = jobs.filter(
              (job) => job.status === "uploading" || job.status === "queued",
            );
            const activeJobs = jobs.filter(
              (job) => job.status === "processing" || job.status === "compressing",
            );

            // Garbage collect stale jobs
            for (const job of staleJobs) {
              try {
                await deleteJob(job.id);
                console.log(
                  `[JobStore] Garbage collected stale job (${job.status}): ${job.original_filename}`,
                );
              } catch (err) {
                console.error(
                  `[JobStore] Failed to delete stale job ${job.id}:`,
                  err,
                );
              }
            }

            if (activeJobs.length > 0) {
              // Populate store with active jobs and keep session
              const jobsMap: Record<string, JobState> = {};
              for (const job of activeJobs) {
                jobsMap[job.id] = {
                  id: job.id,
                  status: job.status,
                  progress: job.progress,
                  current_pass: job.current_pass,
                  original_filename: job.original_filename,
                  original_size: job.original_size,
                  original_width: job.original_width,
                  original_height: job.original_height,
                  input_type: job.input_type,
                  converted_size: job.converted_size,
                  converted_width: job.converted_width,
                  converted_height: job.converted_height,
                  error_message: job.error_message,
                };
              }
              set({ jobs: jobsMap, initialized: true });
              return state.sessionId;
            }
          } catch (err) {
            console.error("[JobStore] Failed to fetch session jobs:", err);
          }
        }

        // No active jobs or no session, create new session
        const newSessionId = uuidv4();
        set({ sessionId: newSessionId, jobs: {}, initialized: true });
        return newSessionId;
      },

      hasActiveJobs: () => {
        const jobs = Object.values(get().jobs);
        return jobs.some(
          (job) =>
            job.status === "uploading" ||
            job.status === "queued" ||
            job.status === "processing" ||
            job.status === "compressing",
        );
      },

      getActiveJobIds: () => {
        const jobs = Object.values(get().jobs);
        return jobs
          .filter(
            (job) =>
              job.status === "uploading" ||
              job.status === "queued" ||
              job.status === "processing" ||
              job.status === "compressing",
          )
          .map((job) => job.id);
      },
    }),
    {
      name: "gif-converter-jobs",
      partialize: (state) => ({
        sessionId: state.sessionId,
        // Don't persist job data - it will be fetched fresh from server
      }),
    },
  ),
);

// Selector hooks for common use cases
export const useJob = (jobId: string): JobState | undefined => {
  return useJobStore((state) => state.jobs[jobId]);
};

export const useSessionId = (): string | null => {
  return useJobStore((state) => state.sessionId);
};

export const useHasActiveJobs = (): boolean => {
  return useJobStore((state) => state.hasActiveJobs());
};
