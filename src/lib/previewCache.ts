// Simple cache for object URLs that need to survive the FileList -> JobList transition
// Maps jobId to the preview URL created from the local file

const previewUrls = new Map<string, string>();

export function setPreviewUrl(jobId: string, url: string): void {
  previewUrls.set(jobId, url);
}

export function getPreviewUrl(jobId: string): string | undefined {
  return previewUrls.get(jobId);
}

export function clearPreviewUrl(jobId: string): void {
  const url = previewUrls.get(jobId);
  if (url) {
    URL.revokeObjectURL(url);
    previewUrls.delete(jobId);
  }
}

export function clearAllPreviewUrls(): void {
  previewUrls.forEach((url) => URL.revokeObjectURL(url));
  previewUrls.clear();
}
