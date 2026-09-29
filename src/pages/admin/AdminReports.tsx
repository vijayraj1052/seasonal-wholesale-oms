import { FileBarChart, Download } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

export function AdminReports() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500 mt-1">
          Export order, inventory, and sales records.
        </p>
      </div>

      <EmptyState
        icon={<FileBarChart className="h-7 w-7" />}
        title="Reports & Export — Phase 2"
        description="This section will provide order summaries, inventory reports, payment tracking reports, and CSV/Excel export functionality for record-keeping."
        action={
          <Button variant="outline" disabled>
            <Download className="h-4 w-4" />
            Export (coming soon)
          </Button>
        }
      />
    </div>
  );
}
