import { useState } from 'react';

import { ErrorState, LoadingState, PageHeader } from '@/components/crud';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRecruitmentAnalyticsQuery } from '@/features/hr/hooks/use-hr-enhancements';
import type { MeasuredRate, MeasuredRatio } from '@/features/hr/types/recruitment-enhancements';

/**
 * Recruitment analytics.
 *
 * Every rate is shown with the sample it came from. "Offer rate 40%" out of five
 * applications is noise, and a figure that hides its own denominator eventually
 * gets presented to a board as if it could not.
 */
export function RecruitmentAnalyticsPage() {
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  const { data, isLoading, isError, refetch } = useRecruitmentAnalyticsQuery(range);

  if (isLoading) return <LoadingState />;
  if (isError || !data) return <ErrorState onRetry={() => void refetch()} />;

  const { kpis, funnel } = data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Recruitment Analytics"
        subtitle="Counted from the pipeline itself. Every rate carries the sample it was measured over."
        actions={
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={range.from ?? ''}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value || undefined }))}
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
            />
            <span className="text-muted-foreground text-sm">to</span>
            <input
              type="date"
              value={range.to ?? ''}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value || undefined }))}
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
            />
          </div>
        }
      />

      {/* ── Headline KPIs ────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <PlainStat label="Open Jobs" value={kpis.open_jobs} />
        <PlainStat label="Applications" value={kpis.applications} />
        <RatioStat label="Applicants per Job" ratio={kpis.applicants_per_job} />
        <PlainStat
          label="Average Time to Hire"
          value={kpis.average_time_to_hire.days === null ? '—' : `${kpis.average_time_to_hire.days} days`}
          hint={
            kpis.average_time_to_hire.hires_measured === 0
              ? 'No hires in this window'
              : `Across ${kpis.average_time_to_hire.hires_measured} hire(s) · fastest ${kpis.average_time_to_hire.fastest_days}d, slowest ${kpis.average_time_to_hire.slowest_days}d`
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RateStat label="Interview Rate" rate={kpis.interview_rate} />
        <RateStat label="Offer Rate" rate={kpis.offer_rate} />
        <RateStat label="Acceptance Rate" rate={kpis.acceptance_rate} />
        <RateStat label="Hiring Rate" rate={kpis.hiring_rate} />
      </div>

      {/* ── Funnel ───────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Funnel Conversion</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {funnel.map((step) => (
            <div key={step.key} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{step.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {step.count}
                  {step.conversion_from_previous !== null && (
                    <span className="ml-2">
                      {step.conversion_from_previous}% of previous
                      {step.dropped_from_previous ? ` · ${step.dropped_from_previous} lost` : ''}
                    </span>
                  )}
                </span>
              </div>
              <div className="bg-muted h-2 w-full overflow-hidden rounded">
                <div className="bg-primary h-full" style={{ width: `${step.share_of_total}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Trend ────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Recruitment Trend &amp; Monthly Hiring</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="flex min-w-[640px] items-end gap-3">
            {data.trend.map((bucket) => {
              const max = Math.max(1, ...data.trend.map((b) => b.applications));
              return (
                <div key={bucket.month} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-32 w-full items-end justify-center gap-1">
                    <div
                      className="bg-primary/30 w-1/2 rounded-t"
                      style={{ height: `${(bucket.applications / max) * 100}%` }}
                      title={`${bucket.applications} applications`}
                    />
                    <div
                      className="bg-primary w-1/2 rounded-t"
                      style={{ height: `${(bucket.hires / max) * 100}%` }}
                      title={`${bucket.hires} hires`}
                    />
                  </div>
                  <span className="text-muted-foreground text-[10px]">{bucket.label}</span>
                </div>
              );
            })}
          </div>
          <p className="text-muted-foreground mt-3 text-xs">
            Pale bars are applications, solid bars are hires. A quiet month reads as zero rather than vanishing.
          </p>
        </CardContent>
      </Card>

      {/* ── Tables ───────────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TableCard
          title="Hiring by Department"
          columns={['Department', 'Applications', 'Hires', 'Rate']}
          rows={data.hiring_by_department.map((row) => [
            row.department_name,
            row.applications,
            row.hires,
            `${row.hire_rate}%`,
          ])}
        />
        <TableCard
          title="Source Effectiveness"
          columns={['Source', 'Applications', 'Hires', 'Rate']}
          rows={data.source_effectiveness.map((row) => [row.source, row.applications, row.hires, `${row.hire_rate}%`])}
          footnote="A source sending four hundred applications and no hires is a cost, not a channel."
        />
        <TableCard
          title="Recruiter Performance"
          columns={['Recruiter', 'Assigned', 'Hires', 'Open', 'Rate']}
          rows={data.recruiter_performance.map((row) => [
            row.name || row.employee_number,
            row.assigned,
            row.hires,
            row.still_open,
            `${row.hire_rate}%`,
          ])}
        />
        <TableCard
          title="Average Time in Stage"
          columns={['Stage', 'Average Days', 'Measured']}
          rows={data.time_in_stage.map((row) => [
            row.stage_name,
            row.average_days === null ? '—' : row.average_days,
            row.candidacies_measured,
          ])}
          footnote="Read from the stage log — the gap between one move and the next is the time spent."
        />
      </div>
    </div>
  );
}

function PlainStat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 pt-6">
        <span className="text-muted-foreground text-xs uppercase tracking-wide">{label}</span>
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
      </CardContent>
    </Card>
  );
}

/** A rate never appears without its denominator. */
function RateStat({ label, rate }: { label: string; rate: MeasuredRate }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 pt-6">
        <span className="text-muted-foreground text-xs uppercase tracking-wide">{label}</span>
        <span className="text-2xl font-semibold tabular-nums">
          {rate.is_measurable ? `${rate.percent}%` : '—'}
        </span>
        <span className="text-muted-foreground text-xs">
          {rate.is_measurable
            ? `${rate.numerator} of ${rate.denominator} — ${rate.meaning}`
            : 'Nothing to measure in this window'}
        </span>
      </CardContent>
    </Card>
  );
}

function RatioStat({ label, ratio }: { label: string; ratio: MeasuredRatio }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 pt-6">
        <span className="text-muted-foreground text-xs uppercase tracking-wide">{label}</span>
        <span className="text-2xl font-semibold tabular-nums">{ratio.is_measurable ? ratio.value : '—'}</span>
        <span className="text-muted-foreground text-xs">
          {ratio.is_measurable ? `${ratio.numerator} across ${ratio.denominator}` : 'No jobs received applications'}
        </span>
      </CardContent>
    </Card>
  );
}

function TableCard({
  title,
  columns,
  rows,
  footnote,
}: {
  title: string;
  columns: string[];
  rows: Array<Array<string | number>>;
  footnote?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs uppercase">
                {columns.map((column) => (
                  <th key={column} className="py-2 pr-4 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="text-muted-foreground py-4 text-center">
                    Nothing in this window.
                  </td>
                </tr>
              )}
              {rows.map((row, index) => (
                <tr key={index} className="border-b last:border-0">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="py-2 pr-4 tabular-nums">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {footnote && <p className="text-muted-foreground mt-3 text-xs">{footnote}</p>}
      </CardContent>
    </Card>
  );
}
