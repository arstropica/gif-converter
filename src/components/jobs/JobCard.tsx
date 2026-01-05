import {
  Download,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Film,
  Image,
} from "lucide-react";
import { useState, useMemo } from "react";

import { getDownloadUrl, getOriginalUrl } from "@/api/client";
import type { Job } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDeleteJob, useRetryJob } from "@/hooks/useJobs";
import { getPreviewUrl, clearPreviewUrl } from "@/lib/previewCache";
import { formatBytes, formatRelativeTime, formatDimensions } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useJob } from "@/store/jobStore";

import { JobStatusBadge } from "./JobStatusBadge";
import SegmentedProgressBar from "../ui/segmentedprogressbar";

interface JobCardProps {
  job: Job;
  selected?: boolean;
  onToggleSelect?: () => void;
}

export function JobCard({
  job: initialJob,
  selected,
  onToggleSelect,
}: JobCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { mutate: deleteJob, isPending: isDeleting } = useDeleteJob();
  const { mutate: retryJob, isPending: isRetrying } = useRetryJob();

  // Get real-time job state from store, fall back to initial job
  const storeJob = useJob(initialJob.id);

  // Merge store state with initial job data
  const job = useMemo(() => {
    if (!storeJob) return initialJob;
    return {
      ...initialJob,
      status: storeJob.status,
      progress: storeJob.progress,
      current_pass: storeJob.current_pass ?? initialJob.current_pass,
      converted_size: storeJob.converted_size ?? initialJob.converted_size,
      converted_width: storeJob.converted_width ?? initialJob.converted_width,
      converted_height: storeJob.converted_height ?? initialJob.converted_height,
      error_message: storeJob.error_message ?? initialJob.error_message,
    };
  }, [initialJob, storeJob]);

  const isActive =
    job.status === "uploading" ||
    job.status === "queued" ||
    job.status === "processing" ||
    job.status === "compressing";
  const canDownload = job.status === "completed";
  const canRetry = job.status === "failed";

  // Thumbnail URL: use local preview during upload, server URL once available
  const thumbnailUrl = useMemo(() => {
    const cachedPreview = getPreviewUrl(job.id);
    if (job.status === "uploading") {
      return cachedPreview;
    }
    // Once upload is complete, we can use server URL and clear the cache
    if (cachedPreview) {
      clearPreviewUrl(job.id);
    }
    return getOriginalUrl(job.id);
  }, [job.id, job.status]);

  // Segmented progress bar: uploading (0-25%), processing (25-99%), complete (99-100%)
  const psegments = { 0: "teal", 25: "orange" } as const;

  // Status message for progress
  const getStatusMessage = () => {
    switch (job.status) {
      case "uploading":
        return "Uploading...";
      case "queued":
        return "Waiting in queue...";
      case "processing":
        return `Pass ${job.current_pass}/3 - ${Math.round(job.progress)}%`;
      case "compressing":
        return "Compressing output...";
      default:
        return "";
    }
  };

  return (
    <Card
      className={cn("p-4 transition-colors", selected && "ring-2 ring-primary")}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox for selection */}
        {onToggleSelect && canDownload && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="mt-1 h-4 w-4 rounded border-gray-300"
          />
        )}

        {/* Preview thumbnail */}
        <div className="w-16 h-16 flex-shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center">
          {job.input_type === "video" ? (
            <Film className="h-8 w-8 text-muted-foreground" />
          ) : thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={job.original_filename}
              className="w-full h-full object-cover"
            />
          ) : (
            <Image className="h-8 w-8 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium truncate">
              {job.original_filename}
            </span>
            <JobStatusBadge status={job.status} currentPass={job.current_pass} />
          </div>

          {/* Progress bar for active jobs */}
          {isActive && (
            <div className="mb-2">
              <SegmentedProgressBar
                percent={job.progress}
                segments={psegments}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {getStatusMessage()}
              </p>
            </div>
          )}

          {/* Stats row for completed jobs */}
          {job.status === "completed" && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{formatBytes(job.original_size)}</span>
              <span>→</span>
              <span className="text-green-600 font-medium">
                {formatBytes(job.converted_size || 0)}
              </span>
              {job.converted_width && job.converted_height && (
                <span className="text-muted-foreground">
                  {job.converted_width} × {job.converted_height}
                </span>
              )}
            </div>
          )}

          {/* Error message */}
          {job.status === "failed" && job.error_message && (
            <p className="text-sm text-destructive truncate">
              {job.error_message}
            </p>
          )}

          {/* Timestamp */}
          <p className="text-xs text-muted-foreground mt-1">
            {formatRelativeTime(job.created_at)}
          </p>

          {/* Expanded details */}
          {expanded && (
            <div className="mt-3 pt-3 border-t text-sm space-y-1">
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <span>Input type:</span>
                <span className="capitalize">{job.input_type}</span>

                <span>Original size:</span>
                <span>{formatBytes(job.original_size)}</span>

                {job.original_width && (
                  <>
                    <span>Original dimensions:</span>
                    <span>
                      {formatDimensions(
                        job.original_width,
                        job.original_height,
                      )}
                    </span>
                  </>
                )}

                {job.converted_size && (
                  <>
                    <span>Output size:</span>
                    <span>{formatBytes(job.converted_size)}</span>
                  </>
                )}

                {job.converted_width && (
                  <>
                    <span>Output dimensions:</span>
                    <span>
                      {formatDimensions(
                        job.converted_width,
                        job.converted_height,
                      )}
                    </span>
                  </>
                )}

                {job.options.width && (
                  <>
                    <span>Target width:</span>
                    <span>{job.options.width}</span>
                  </>
                )}

                {job.options.height && (
                  <>
                    <span>Target height:</span>
                    <span>{job.options.height}</span>
                  </>
                )}

                {job.options.transpose !== 0 && (
                  <>
                    <span>Rotation:</span>
                    <span>
                      {job.options.transpose === 1 && "90° CW"}
                      {job.options.transpose === 2 && "90° CCW"}
                      {job.options.transpose === 3 && "180°"}
                    </span>
                  </>
                )}

                {job.options.compress_output && (
                  <>
                    <span>Post-compression:</span>
                    <span>Enabled</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          {canDownload && (
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <a href={getDownloadUrl(job.id)} download>
                <Download className="h-4 w-4" />
              </a>
            </Button>
          )}

          {canRetry && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => retryJob(job.id)}
              disabled={isRetrying}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => deleteJob(job.id)}
            disabled={isDeleting || isActive}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
