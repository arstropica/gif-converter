import { create } from "zustand";

import type { JobStatus } from "@/api/types";

interface JobsStore {
  // Filter state
  statusFilter: JobStatus | "all";
  filenameFilter: string;

  // Selection state for bulk actions
  selectedJobIds: Set<string>;

  // Actions
  setStatusFilter: (status: JobStatus | "all") => void;
  setFilenameFilter: (filename: string) => void;
  clearFilters: () => void;

  // Selection actions
  toggleJobSelected: (jobId: string) => void;
  selectAllJobs: (jobIds: string[]) => void;
  deselectAllJobs: () => void;
}

export const useJobsStore = create<JobsStore>((set) => ({
  statusFilter: "all",
  filenameFilter: "",
  selectedJobIds: new Set(),

  setStatusFilter: (status) => set({ statusFilter: status }),
  setFilenameFilter: (filename) => set({ filenameFilter: filename }),
  clearFilters: () => set({ statusFilter: "all", filenameFilter: "" }),

  toggleJobSelected: (jobId) =>
    set((state) => {
      const newSet = new Set(state.selectedJobIds);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return { selectedJobIds: newSet };
    }),

  selectAllJobs: (jobIds) => set({ selectedJobIds: new Set(jobIds) }),
  deselectAllJobs: () => set({ selectedJobIds: new Set() }),
}));
