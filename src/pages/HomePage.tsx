import { Plus } from "lucide-react";
import { useState, useCallback } from "react";

import { uploadFiles } from "@/api/client";
import { JobList } from "@/components/jobs/JobList";
import { GlobalSettings } from "@/components/settings/GlobalSettings";
import { Button } from "@/components/ui/button";
import { DropZone } from "@/components/upload/DropZone";
import { FileList } from "@/components/upload/FileList";
import { setPreviewUrl } from "@/lib/previewCache";
import { useJobStore, useSessionId, useHasActiveJobs } from "@/store/jobStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUploadStore } from "@/store/uploadStore";

export function HomePage() {
  const { files, clearFiles, getFileOptions } = useUploadStore();
  const { globalOptions, backgroundImageFile } = useSettingsStore();
  const setJob = useJobStore((state) => state.setJob);
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
    if (files.length === 0) return;

    setError(null);
    setIsConverting(true);
    setShowUploadArea(false);

    try {
      // Build per-file options map
      const perFileOptions: Record<string, typeof globalOptions> = {};
      files.forEach((f) => {
        const opts = getFileOptions(f.id);
        if (opts) {
          perFileOptions[f.file.name] = opts;
        }
      });

      // Transfer preview URLs to cache before clearing files
      files.forEach((f) => {
        setPreviewUrl(f.id, f.preview);
      });

      // Upload files
      const filesToUpload = files.map((f) => f.file);
      const response = await uploadFiles(
        filesToUpload,
        globalOptions,
        Object.keys(perFileOptions).length > 0 ? perFileOptions : undefined,
        backgroundImageFile || undefined,
      );

      // Initialize jobs in the store
      response.jobs.forEach((job, index) => {
        const pendingFile = files[index];
        // Store the preview URL in cache so JobCard can use it
        if (pendingFile) {
          setPreviewUrl(job.id, pendingFile.preview);
        }
        setJob(job.id, {
          id: job.id,
          status: "queued",
          progress: 0,
          current_pass: 0,
          original_filename: job.filename,
          original_size: pendingFile?.file.size || 0,
          input_type: pendingFile?.inputType || "video",
        });
      });

      // Clear pending files - don't revoke URLs, they're in previewCache
      clearFiles(false);
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
    backgroundImageFile,
    setJob,
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

            {/* Job list for current session - always show when there are jobs */}
            {hasSessionJobs && sessionId && (
              <JobList
                sessionId={sessionId}
                showFilters={false}
                showBulkActions={true}
                perPage={-1}
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
