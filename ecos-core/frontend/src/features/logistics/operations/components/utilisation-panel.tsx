import { Skeleton } from '@/components/ui/skeleton';

import { useAvailabilityMatrix, useUtilisation } from '../hooks/use-operations';

function percent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${Math.round(value * 100)}%`;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      {children}
    </div>
  );
}

/** Colour by how close a day is to running out. */
function cellClass(utilisation: number | null): string {
  if (utilisation === null) return 'text-muted-foreground';
  if (utilisation >= 1) return 'text-destructive font-medium';
  if (utilisation >= 0.85) return 'text-amber-600';
  return '';
}

/**
 * Supply against demand, one row per pool, one column per day.
 *
 * Supply is a TODAY figure repeated across the row. A fitness verdict a week out
 * would be a guess, and this module does not guess — the header says so rather
 * than letting the repetition read as a forecast.
 */
export function UtilisationPanel() {
  const { data: utilisation } = useUtilisation();
  const { data: matrix, isLoading } = useAvailabilityMatrix(undefined, 7);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Vehicles available', value: utilisation?.pooled_available_vehicles ?? 0 },
          { label: 'Drivers available', value: utilisation?.pooled_available_drivers ?? 0 },
          // The pairing that actually limits a day.
          { label: 'Can field today', value: utilisation?.fieldable_units ?? 0 },
          { label: 'Capacity used', value: percent(utilisation?.capacity_utilisation) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border bg-card p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {stat.label}
            </p>
            <p className="mt-1 text-2xl tabular-nums">{stat.value}</p>
          </div>
        ))}
      </div>

      <Panel title="Availability matrix">
        <p className="mb-3 text-xs text-muted-foreground">
          Supply is today&apos;s figure. Capacity is what Network has already committed for each
          day.
        </p>

        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !matrix || matrix.rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No active pools to plan with.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="h-9 pr-3 font-normal">Pool</th>
                  <th className="h-9 px-3 text-right font-normal">Can field</th>
                  {matrix.dates.map((date) => (
                    <th key={date} className="h-9 px-2 text-right font-normal">
                      {new Date(date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {matrix.rows.map((row) => (
                  <tr key={row.pool_id}>
                    <td className="py-2 pr-3">
                      <div className="font-medium">{row.pool_name}</div>
                      {row.service_area && (
                        <div className="text-[11px] text-muted-foreground">{row.service_area}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {Math.min(row.available_vehicles, row.available_drivers)}
                    </td>
                    {row.cells.map((cell) => (
                      <td
                        key={cell.date}
                        className={`px-2 py-2 text-right tabular-nums ${cellClass(cell.utilisation)}`}
                        title={
                          cell.has_capacity_plan
                            ? `${cell.committed} of ${cell.available} committed`
                            : 'No capacity plan for this day'
                        }
                      >
                        {/* Null means no plan exists — not the same fact as
                            a day with nothing booked. */}
                        {cell.utilisation === null ? '—' : `${Math.round(cell.utilisation * 100)}%`}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
