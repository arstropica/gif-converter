import { Badge } from "@/components/ui/badge";
import type { JobStatus } from "@/api/types";

interface JobStatusBadgeProps {
  status: JobStatus;
  currentPass?: number;
}

const statusConfig: Record<
  JobStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }
> = {
  uploading: { label: "Uploading", variant: "default" },
  queued: { label: "Queued", variant: "secondary" },
  processing: { label: "Processing", variant: "warning" },
  compressing: { label: "Compressing", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
};

export function JobStatusBadge({ status, currentPass }: JobStatusBadgeProps) {
  const config = statusConfig[status];

  let label = config.label;
  if (status === "processing" && currentPass) {
    label = `Pass ${currentPass}/3`;
  }

  return <Badge variant={config.variant}>{label}</Badge>;
}
