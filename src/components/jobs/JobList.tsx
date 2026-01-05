import { Download, Loader2 } from "lucide-react";
import { useEffect, useRef, useCallback } from "react";

import { getZipDownloadUrl } from "@/api/client";
import type { JobStatus } from "@/api/types";
import { Button } from "@/components/ui/button";
import { useJobs } from "@/hooks/useJobs";
import { useJobsStore } from "@/store/jobsStore";
import { useJobStore } from "@/store/jobStore";

import { JobCard } from "./JobCard";
import { JobFilters } from "./JobFilters";

interface JobListProps {
  // Filter by session ID (for HomePage - current session jobs)
  sessionId?: string;
  // Filter by specific statuses (for HistoryPage - completed/failed only)
  statusFilter?: JobStatus | JobStatus[];
  // Show/hide the filter UI
  showFilters?: boolean;
  // Show/hide bulk selection controls
  showBulkActions?: boolean;
  // Empty state message
  emptyMessage?: string;
  // Per page job limit (default 20, -1 for no pagination)
  perPage?: number;
}

export function JobList({
  sessionId,
  statusFilter: propStatusFilter,
  showFilters = true,
  showBulkActions = true,
  perPage = 20,
  emptyMessage = "No jobs found. Upload some files to get started!",
}: JobListProps) {
  const {
    statusFilter: storeStatusFilter,
    filenameFilter,
    selectedJobIds,
    toggleJobSelected,
    selectAllJobs,
    deselectAllJobs,
  } = useJobsStore();

  const setJobs = useJobStore((state) => state.setJobs);

  // Use prop status filter if provided, otherwise use store filter
  const effectiveStatusFilter = propStatusFilter ?? storeStatusFilter;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useJobs({
    status: effectiveStatusFilter,
    session_id: sessionId,
    filename: filenameFilter || undefined,
    limit: perPage > 0 ? perPage : 100,
  });

  // Sync fetched jobs to the store for real-time updates
  useEffect(() => {
    if (data?.pages) {
      const allJobs = data.pages.flatMap((page) => page.jobs);
      setJobs(allJobs);
    }
  }, [data, setJobs]);

  // Flatten pages into single array
  const jobs = data?.pages.flatMap((page) => page.jobs) || [];
  const completedJobs = jobs.filter((j) => j.status === "completed");
  const completedJobIds = completedJobs.map((j) => j.id);

  // Infinite scroll
  const loaderRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      rootMargin: "100px",
    });

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [handleObserver]);

  // Selection helpers
  const selectedCount = selectedJobIds.size;
  const allSelected =
    selectedCount > 0 && selectedCount === completedJobIds.length;

  const handleSelectAll = () => {
    if (allSelected) {
      deselectAllJobs();
    } else {
      selectAllJobs(completedJobIds);
    }
  };

  const handleDownloadSelected = () => {
    const ids = Array.from(selectedJobIds);
    if (ids.length > 0) {
      window.location.href = getZipDownloadUrl(ids);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12 text-destructive">
        Failed to load jobs. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      {showFilters && <JobFilters />}

      {/* Bulk actions */}
      {showBulkActions && completedJobs.length > 0 && (
        <div className="flex items-center gap-3 py-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={handleSelectAll}
              className="h-4 w-4 rounded border-gray-300"
            />
            Select all completed ({completedJobs.length})
          </label>

          {selectedCount > 0 && (
            <Button size="sm" onClick={handleDownloadSelected}>
              <Download className="h-4 w-4 mr-1" />
              Download {selectedCount} as ZIP
            </Button>
          )}
        </div>
      )}

      {/* Job list */}
      {jobs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              selected={selectedJobIds.has(job.id)}
              onToggleSelect={
                job.status === "completed"
                  ? () => toggleJobSelected(job.id)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {/* Infinite scroll loader */}
      {perPage > 0 && (
        <div ref={loaderRef} className="py-4 text-center">
          {isFetchingNextPage && (
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          )}
          {!hasNextPage && jobs.length > 0 && (
            <p className="text-sm text-muted-foreground">No more jobs</p>
          )}
        </div>
      )}
    </div>
  );
}
