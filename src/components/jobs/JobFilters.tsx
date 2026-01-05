import { X } from "lucide-react";

import type { JobStatus } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useJobsStore } from "@/store/jobsStore";

export function JobFilters() {
  const {
    statusFilter,
    filenameFilter,
    setStatusFilter,
    setFilenameFilter,
    clearFilters,
  } = useJobsStore();

  const hasFilters = statusFilter !== "all" || filenameFilter !== "";

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Select
        value={statusFilter}
        onValueChange={(v) => setStatusFilter(v as JobStatus | "all")}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="uploading">Uploading</SelectItem>
          <SelectItem value="queued">Queued</SelectItem>
          <SelectItem value="processing">Processing</SelectItem>
          <SelectItem value="compressing">Compressing</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
        </SelectContent>
      </Select>

      <Input
        placeholder="Search filename..."
        value={filenameFilter}
        onChange={(e) => setFilenameFilter(e.target.value)}
        className="w-48"
      />

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
