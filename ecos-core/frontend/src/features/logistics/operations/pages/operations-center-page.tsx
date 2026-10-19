import { Activity, AlertTriangle, ArrowUpCircle, Gauge, Layers, XCircle } from 'lucide-react';

import { WorkspaceHeader } from '@/components/workspace/header/workspace-header';
import { WorkspacePage } from '@/components/page/layout/workspace-page';
import { SmartToolbar } from '@/components/data-grid/smart-toolbar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useHealthOverview } from '../hooks/use-operations';
import { ExceptionsPanel } from '../components/exceptions-panel';
import { ResourcePoolsPanel } from '../components/resource-pools-panel';
import { CapacityPanel } from '../components/capacity-panel';
import { UtilisationPanel } from '../components/utilisation-panel';

/**
 * Logistics Operations Center.
 *
 * Exception-driven, not inventory-driven (§7.1): the headline is what needs a
 * person, and the target is that this screen is boring when the operation is
 * healthy. Every number belongs to another module — Fleet, Drivers, Network or
 * Dispatch — and is reported here rather than recomputed, so no figure on this
 * page can disagree with the module that owns it.
 */
export function OperationsCenterPage() {
  const { data: health, refetch, isFetching } = useHealthOverview();

  const headline = health?.headline;

  const metrics = [
    {
      id: 'alerts',
      icon: XCircle,
      label: 'Critical Alerts',
      value: headline?.critical_alerts ?? 0,
      isLoading: !health,
      colorClass: 'text-destructive',
    },
    {
      id: 'exceptions',
      icon: AlertTriangle,
      label: 'Needs Attention',
      value: headline?.open_exceptions ?? 0,
      isLoading: !health,
      colorClass: 'text-amber-600',
    },
    {
      id: 'pools',
      icon: Layers,
      label: 'Unhealthy Pools',
      value: headline?.unhealthy_pools ?? 0,
      isLoading: !health,
      colorClass: 'text-amber-600',
    },
    {
      id: 'capacity',
      icon: Gauge,
      label: 'Exhausted Slots',
      value: headline?.exhausted_capacity_slots ?? 0,
      isLoading: !health,
    },
    {
      id: 'fieldable',
      // Vehicles and drivers paired: whichever runs out first limits the day.
      icon: Activity,
      label: 'Can Field Today',
      value: headline?.fieldable_units ?? 0,
      isLoading: !health,
      colorClass: 'text-emerald-600',
    },
    {
      id: 'escalations',
      icon: ArrowUpCircle,
      label: 'Overdue Escalations',
      value: headline?.overdue_escalations ?? 0,
      isLoading: !health,
      colorClass: 'text-destructive',
    },
  ];

  const needsAttention = (headline?.open_exceptions ?? 0) + (headline?.critical_alerts ?? 0);

  return (
    <>
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Logistics OS' }, { label: 'Operations' }]}
        title="Operations Center"
        description="Resource pools, capacity, health and the exception queue"
        metrics={metrics}
      />

      <WorkspacePage
        toolbar={
          <div className="px-4 sm:px-6">
            <SmartToolbar onRefresh={() => refetch()} isFetching={isFetching} />
          </div>
        }
      >
        <div className="px-4 pb-6 sm:px-6">
          {/* Land on the queue when something needs a person; otherwise show
              what the operation is made of. */}
          <Tabs defaultValue={needsAttention > 0 ? 'exceptions' : 'pools'} className="w-full">
            <TabsList>
              <TabsTrigger value="exceptions">
                Exceptions{needsAttention > 0 ? ` (${needsAttention})` : ''}
              </TabsTrigger>
              <TabsTrigger value="pools">Resource Pools</TabsTrigger>
              <TabsTrigger value="capacity">Capacity</TabsTrigger>
              <TabsTrigger value="utilisation">Utilisation</TabsTrigger>
            </TabsList>

            <TabsContent value="exceptions" className="pt-4">
              <ExceptionsPanel />
            </TabsContent>

            <TabsContent value="pools" className="pt-4">
              <ResourcePoolsPanel />
            </TabsContent>

            <TabsContent value="capacity" className="pt-4">
              <CapacityPanel />
            </TabsContent>

            <TabsContent value="utilisation" className="pt-4">
              <UtilisationPanel />
            </TabsContent>
          </Tabs>
        </div>
      </WorkspacePage>
    </>
  );
}
