import { Plus } from "lucide-react";
import { useState, useCallback } from "react";

import { createJobsBatch, uploadJobFile, getInputTypeFromFile } from "@/api/client";
import { JobList } from "@/components/jobs/JobList";
import { GlobalSettings } from "@/components/settings/GlobalSettings";
import { Button } from "@/components/ui/button";
import { DropZone } from "@/components/upload/DropZone";
import { FileList } from "@/components/upload/FileList";
import { setPreviewUrl } from "@/lib/previewCache";
import { useJobStore, useSessionId, useHasActiveJobs, type JobState } from "@/store/jobStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUploadStore } from "@/store/uploadStore";

export function HomePage() {
  const { files, clearFiles, getFileOptions } = useUploadStore();
  const { globalOptions, backgroundImageFile } = useSettingsStore();
  const setJob = useJobStore((state) => state.setJob);
  const updateJob = useJobStore((state) => state.updateJob);
  const jobs = useJobStore((state) => state.jobs);
  const sessionId = useSessionId();
  const hasActiveJobs = useHasActiveJobs();

  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUploadArea, setShowUploadArea] = useState(true);

  // Check if we have any jobs for the current session
  const hasSessionJobs = Object.keys(jobs).length > 0;

  // Show upload area when appropriate
  const shouldShowUploadArea = showUploadArea || files.length > 0;

  const handleConvertMore = useCallback(() => {
    setShowUploadArea(true);
  }, []);

  const handleConvert = useCallback(async () => {
    if (files.length === 0 || !sessionId) return;

    setError(null);
    setIsConverting(true);
    setShowUploadArea(false);

    try {
      // Build file info for batch creation
      const fileInfos = files.map((f) => {
        const opts = getFileOptions(f.id);
        return {
          filename: f.file.name,
          size: f.file.size,
          options: opts || globalOptions,
          inputType: getInputTypeFromFile(f.file),
        };
      });

      // Step 1: Create jobs on server (before uploading)
      const batchResponse = await createJobsBatch({
        files: fileInfos,
        sessionId,
      });

      // Step 2: Add jobs to store with "uploading" status and show them immediately
      const jobFileMap: { jobId: string; file: File; pendingFile: typeof files[0] }[] = [];

      batchResponse.jobs.forEach((job, index) => {
        const pendingFile = files[index];
        if (pendingFile) {
          setPreviewUrl(job.id, pendingFile.preview);
          jobFileMap.push({ jobId: job.id, file: pendingFile.file, pendingFile });
        }

        setJob(job.id, {
          id: job.id,
          status: "uploading",
          progress: 0,
          current_pass: 0,
          original_filename: job.filename,
          original_size: pendingFile?.file.size || 0,
          input_type: pendingFile?.inputType || "video",
        });
      });

      // Clear pending files from upload store (JobCards are now showing)
      clearFiles(false);

      // Step 3: Upload files one by one with progress tracking
      for (const { jobId, file } of jobFileMap) {
        try {
          await uploadJobFile(jobId, file, (uploadProgress) => {
            // Show upload progress directly (0-100%)
            updateJob(jobId, { progress: uploadProgress });
          });
          // After upload completes, mark as queued (server will set progress when processing starts)
          updateJob(jobId, { status: "queued", progress: 0 });
        } catch (err) {
          // Mark individual job as failed if upload fails
          updateJob(jobId, {
            status: "failed",
            error_message: err instanceof Error ? err.message : "Upload failed"
          });
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start conversion",
      );
      setShowUploadArea(true);
    } finally {
      setIsConverting(false);
    }
  }, [
    files,
    globalOptions,
    sessionId,
    setJob,
    updateJob,
    clearFiles,
    getFileOptions,
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">GIF Converter</h1>
          <p className="text-muted-foreground">
            Convert videos and images to high-quality GIFs with full control
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left column - Upload/Jobs area */}
          <div className="lg:col-span-2 space-y-4">
            {/* File provisioning UI - show when appropriate */}
            {shouldShowUploadArea && (
              <>
                <DropZone />
                <FileList
                  onConvert={handleConvert}
                  isConverting={isConverting}
                />

                {error && (
                  <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
                    {error}
                  </div>
                )}
              </>
            )}

            {/* Job list for current session - show when there are jobs OR during conversion */}
            {(hasSessionJobs || isConverting) && sessionId && (
              <JobList
                sessionId={sessionId}
                showFilters={false}
                showBulkActions={true}
                perPage={-1}
                emptyMessage={isConverting ? "Uploading files..." : "No jobs found. Upload some files to get started!"}
              />
            )}

            {/* Show convert more button when upload area is hidden */}
            {!shouldShowUploadArea && (
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={handleConvertMore}
              >
                <Plus className="h-5 w-5 mr-2" />
                Convert More Files
              </Button>
            )}
          </div>

          {/* Right column - Settings */}
          <div className="space-y-4">
            <GlobalSettings />
          </div>
        </div>
      </div>
    </div>
  );
}
