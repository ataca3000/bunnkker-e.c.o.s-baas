import { useState } from 'react';
import { Download, FileText, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useIntelligenceReports, buildExportUrl } from '../../hooks/use-intelligence';
import { IntelligenceFilterBar } from '../components/intelligence-filter-bar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { IntelligenceFilters, MarketingReport } from '../../types/intelligence';

const REPORT_TYPE_LABELS: Record<string, string> = {
  campaigns: 'Campaign Report',
  ads:       'Ad Report',
  creatives: 'Creative Report',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  completed: <CheckCircle className="h-3.5 w-3.5 text-green-600" />,
  failed:    <XCircle className="h-3.5 w-3.5 text-red-600" />,
  pending:   <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin" />,
  running:   <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin" />,
};

function ReportRow({ report }: { report: MarketingReport }) {
  const generatedAt = report.generated_at
    ? new Date(report.generated_at).toLocaleString()
    : null;

  return (
    <div className="px-4 py-3 flex items-start gap-3 border-b last:border-0">
      <div className="mt-0.5 flex-shrink-0">
        <FileText className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate">
            {report.report_name || REPORT_TYPE_LABELS[report.type] || report.type}
          </span>
          <div className="flex items-center gap-1">
            {STATUS_ICONS[report.status] ?? null}
            <Badge
              variant={
                report.status === 'completed' ? 'default' :
                report.status === 'failed'    ? 'destructive' : 'secondary'
              }
              className="text-[10px] py-0 px-1.5"
            >
              {report.status}
            </Badge>
          </div>
          {report.is_expired && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-muted-foreground">
              Expired
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-muted-foreground">
          {report.row_count != null && (
            <span>{report.row_count.toLocaleString()} rows</span>
          )}
          {generatedAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {generatedAt}
            </span>
          )}
          {report.expires_at && !report.is_expired && (
            <span>Expires {new Date(report.expires_at).toLocaleDateString()}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function ReportsPage() {
  const [exportFilters, setExportFilters] = useState<IntelligenceFilters>({ date_preset: 'last_30d' });
  const [reportType, setReportType] = useState<'campaigns' | 'ads' | 'creatives'>('campaigns');

  const { data, isLoading, isFetching, refetch } = useIntelligenceReports({ per_page: 25 });

  const reports  = data?.data ?? [];
  const meta     = data?.meta;

  function triggerExport(format: 'csv' | 'excel' | 'html') {
    window.open(buildExportUrl(reportType, exportFilters, format), '_blank');
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Generate and download marketing performance reports
        </p>
      </div>

      {/* Generate Report Panel */}
      <div className="rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold mb-4">Generate New Report</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">Report Type</label>
            <Select value={reportType} onValueChange={(v) => setReportType(v as typeof reportType)}>
              <SelectTrigger className="w-44 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="campaigns">Campaign Report</SelectItem>
                <SelectItem value="ads">Ad Report</SelectItem>
                <SelectItem value="creatives">Creative Report</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">Date Range</label>
            <IntelligenceFilterBar
              filters={exportFilters}
              onFilterChange={(p) => setExportFilters((f) => ({ ...f, ...p }))}
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="sm:self-end h-9">
                <Download className="h-4 w-4 mr-2" /> Download Report
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs">Format</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => triggerExport('csv')}>
                CSV — comma-separated
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => triggerExport('excel')}>
                Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => triggerExport('html')}>
                HTML — styled table
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Report History */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium">
            Report History
            {meta && <span className="ml-2 text-muted-foreground font-normal">({meta.total})</span>}
          </h2>
          <Button size="sm" variant="ghost" className="h-8" onClick={() => refetch()} disabled={isFetching}>
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="rounded-lg border animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3 border-b flex gap-3">
                <div className="w-4 h-4 rounded bg-muted flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-40 rounded bg-muted" />
                  <div className="h-2.5 w-24 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No reports generated yet. Use the form above to generate your first report.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            {reports.map((report) => (
              <ReportRow key={report.id} report={report} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
