import { useState } from 'react';
import { ChevronRight, Layers, Users } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';

import { usePoolHealthOverview, useUnassignedResources } from '../hooks/use-operations';
import { PoolStatusBadge } from './operations-badges';
import { PoolDrawer } from './pool-drawer';

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      {children}
    </div>
  );
}

/**
 * Pools, worst first.
 *
 * The list leads with what a pool can actually field today, because a pool with
 * forty members and no available drivers fields nothing — and the member count
 * alone hides that completely.
 */
export function ResourcePoolsPanel() {
  const { data, isLoading } = usePoolHealthOverview();
  const { data: unassigned } = useUnassignedResources();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const pools = data?.pools ?? [];

  return (
    <div className="space-y-4">
      <Panel title={`Pools (${pools.length})`}>
        {pools.length === 0 ? (
          <div className="py-12 text-center">
            <Layers className="mx-auto mb-3 size-10 text-muted-foreground/20" />
            <p className="text-sm font-medium">No pools yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              A pool groups vehicles and drivers that already exist — it never creates them.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="h-9 pr-3 font-medium">Pool</th>
                  <th className="h-9 px-3 font-medium">Status</th>
                  <th className="h-9 px-3 text-right font-medium">Vehicles</th>
                  <th className="h-9 px-3 text-right font-medium">Drivers</th>
                  <th className="h-9 px-3 text-right font-medium">Can field</th>
                  <th className="h-9 px-3 font-medium">Issues</th>
                  <th className="h-9 w-8 px-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {pools.map((pool) => (
                  <tr
                    key={pool.pool_id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => {
                      setSelectedId(pool.pool_id);
                      setDrawerOpen(true);
                    }}
                  >
                    <td className="py-2.5 pr-3 font-medium">{pool.pool_name}</td>
                    <td className="px-3 py-2.5">
                      <PoolStatusBadge status={pool.status} />
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {pool.counts.available_vehicles}
                      <span className="text-muted-foreground">/{pool.counts.vehicles}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {pool.counts.available_drivers}
                      <span className="text-muted-foreground">/{pool.counts.drivers}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {/* Whichever side runs out first limits the day. */}
                      <span className={pool.fieldable_units === 0 ? 'text-destructive' : ''}>
                        {pool.fieldable_units}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {pool.is_healthy ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="text-amber-600">{pool.issues[0]}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* An assignable resource in no pool is capacity nobody is planning with —
          the loss that is invisible in V1. */}
      <Panel title="In no pool">
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <span className="tabular-nums">{unassigned?.idle_assignable_vehicles ?? 0}</span>
            <span className="text-muted-foreground">assignable vehicles</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <span className="tabular-nums">{unassigned?.idle_available_drivers ?? 0}</span>
            <span className="text-muted-foreground">available drivers</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          These are ready to work and belong to no pool, so nothing is planning with them.
        </p>
      </Panel>

      <PoolDrawer poolId={selectedId} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
