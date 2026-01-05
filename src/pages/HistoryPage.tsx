import { JobList } from "@/components/jobs";

export function HistoryPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Conversion History</h1>
          <p className="text-muted-foreground">
            View and manage your past conversions
          </p>
        </div>

        <JobList
          showFilters={true}
          showBulkActions={true}
          perPage={20}
          emptyMessage="No conversions yet. Upload some files to get started!"
        />
      </div>
    </div>
  );
}
