import { Upload, Film, Image } from "lucide-react";
import { useCallback, useState } from "react";

import { useUploadStore } from "@/store/uploadStore";

const ACCEPT_STRING =
  ".mp4,.mov,.avi,.webm,.png,.jpg,.jpeg,.tiff,.tif,.webp";

const SUPPORTED_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
  "image/png",
  "image/jpeg",
  "image/tiff",
  "image/webp",
];

export function DropZone() {
  const { addFiles, isUploading } = useUploadStore();
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (isUploading) return;

      const files = Array.from(e.dataTransfer.files).filter((f) =>
        SUPPORTED_TYPES.includes(f.type)
      );
      if (files.length > 0) {
        addFiles(files);
      }
    },
    [addFiles, isUploading]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isUploading) return;

      const files = e.target.files;
      if (files && files.length > 0) {
        addFiles(Array.from(files));
      }
      // Reset input
      e.target.value = "";
    },
    [addFiles, isUploading]
  );

  return (
    <div
      className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50"
      } ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => {
        if (!isUploading) {
          document.getElementById("file-input")?.click();
        }
      }}
    >
      <input
        id="file-input"
        type="file"
        accept={ACCEPT_STRING}
        multiple
        className="hidden"
        onChange={handleFileSelect}
        disabled={isUploading}
      />

      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2">
          <Film className="h-12 w-12 text-muted-foreground" />
          <Upload className="h-8 w-8 text-muted-foreground" />
          <Image className="h-12 w-12 text-muted-foreground" />
        </div>

        <div>
          <p className="text-lg font-medium">
            {isDragging ? "Drop files here" : "Drag & drop files here"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            or click to browse
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          Supports: MP4, MOV, AVI, WebM, PNG, JPG, TIFF, WebP (up to 100MB)
        </p>
      </div>
    </div>
  );
}
