import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import * as api from "@/api/client";
import type {
  JobFilters,
  ConversionOptions,
  BatchCreateRequest,
} from "@/api/types";

export const jobsKeys = {
  all: ["jobs"] as const,
  lists: () => [...jobsKeys.all, "list"] as const,
  list: (filters: JobFilters) => [...jobsKeys.lists(), filters] as const,
  details: () => [...jobsKeys.all, "detail"] as const,
  detail: (id: string) => [...jobsKeys.details(), id] as const,
  counts: () => [...jobsKeys.all, "counts"] as const,
  queue: () => ["queue"] as const,
};

export function useJobs(filters: JobFilters = {}) {
  return useInfiniteQuery({
    queryKey: jobsKeys.list(filters),
    queryFn: ({ pageParam = 0 }) =>
      api.listJobs({
        ...filters,
        offset: pageParam,
        limit: filters.limit || 20,
      }),
    getNextPageParam: (lastPage) => {
      const hasMore = lastPage.offset + lastPage.limit < lastPage.total;
      return hasMore ? lastPage.offset + lastPage.limit : undefined;
    },
    initialPageParam: 0,
    refetchInterval: 5000,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: jobsKeys.detail(id),
    queryFn: () => api.getJob(id),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === "completed" || data?.status === "failed") {
        return false;
      }
      return 2000;
    },
  });
}

export function useJobCounts() {
  return useQuery({
    queryKey: jobsKeys.counts(),
    queryFn: api.getJobCounts,
    refetchInterval: 5000,
  });
}

export function useQueueConfig() {
  return useQuery({
    queryKey: jobsKeys.queue(),
    queryFn: api.getQueueConfig,
    refetchInterval: 5000,
  });
}

export function useUploadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      files,
      globalOptions,
      perFileOptions,
      backgroundImage,
    }: {
      files: File[];
      globalOptions: ConversionOptions;
      perFileOptions?: Record<string, ConversionOptions>;
      backgroundImage?: File;
    }) => api.uploadFiles(files, globalOptions, perFileOptions, backgroundImage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsKeys.all });
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: string) => api.deleteJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsKeys.all });
    },
  });
}

export function useRetryJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: string) => api.retryJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsKeys.all });
    },
  });
}

export function useSetQueueConcurrency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (concurrency: number) => api.setQueueConcurrency(concurrency),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsKeys.queue() });
    },
  });
}

export function useBatchCreateJobs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: BatchCreateRequest) => api.createJobsBatch(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsKeys.all });
    },
  });
}

export function useUploadJobFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      jobId,
      file,
      onProgress,
    }: {
      jobId: string;
      file: File;
      onProgress?: (progress: number) => void;
    }) => api.uploadJobFile(jobId, file, onProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsKeys.all });
    },
  });
}
