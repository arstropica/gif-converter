import { X, Film, Image } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils";
import { useUploadStore } from "@/store/uploadStore";

interface FileListProps {
  onConvert?: () => void;
  isConverting?: boolean;
}

export function FileList({ onConvert, isConverting = false }: FileListProps) {
  const { files, removeFile, clearFiles } = useUploadStore();

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{files.length} file(s) selected</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => clearFiles()}
          disabled={isConverting}
        >
          Clear all
        </Button>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {files.map((file) => (
          <div
            key={file.id}
            className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
          >
            {/* Preview */}
            <div className="relative h-12 w-12 flex-shrink-0 rounded overflow-hidden bg-muted">
              {file.inputType === "video" ? (
                <div className="flex items-center justify-center h-full">
                  <Film className="h-6 w-6 text-muted-foreground" />
                </div>
              ) : (
                <img
                  src={file.preview}
                  alt={file.file.name}
                  className="h-full w-full object-cover"
                />
              )}
            </div>

            {/* File info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.file.name}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatBytes(file.file.size)}</span>
                <span className="inline-flex items-center gap-1">
                  {file.inputType === "video" ? (
                    <>
                      <Film className="h-3 w-3" />
                      Video
                    </>
                  ) : (
                    <>
                      <Image className="h-3 w-3" />
                      Image
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Remove button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => removeFile(file.id)}
              disabled={isConverting}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Convert button */}
      {onConvert && files.length > 0 && (
        <Button
          size="lg"
          className="w-full"
          onClick={onConvert}
          disabled={isConverting}
        >
          {isConverting ? "Converting..." : `Convert ${files.length} file(s)`}
        </Button>
      )}
    </div>
  );
}
