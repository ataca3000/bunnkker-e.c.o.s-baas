import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/router/routes';
import { useDriverStops } from '../hooks/use-driver-mobile';
import { DeliveryStopCard } from '../components/delivery-stop-card';
import { STOP_STATUS_LABELS } from '../types/driver-mobile';
import type { DeliveryStop, DeliveryStopStatus } from '../types/driver-mobile';

type FilterTab = 'all' | DeliveryStopStatus;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'pending',   label: STOP_STATUS_LABELS.pending },
  { key: 'delivered', label: STOP_STATUS_LABELS.delivered },
  { key: 'failed',    label: STOP_STATUS_LABELS.failed },
];

export function DriverStopListPage() {
  const { tripId = '' } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [search,    setSearch]    = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const { data: stops, isLoading } = useDriverStops(tripId);

  const filtered = (stops ?? []).filter((stop: DeliveryStop) => {
    const matchesTab =
      activeTab === 'all' || stop.status === activeTab;

    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      (stop.order?.order_number ?? '').toLowerCase().includes(q) ||
      (stop.order?.customer_name ?? '').toLowerCase().includes(q);

    return matchesTab && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 space-y-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(ROUTES.driverTrip.replace(':tripId', tripId))}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-base">Stop List</h1>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by order number or customer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1">
          {FILTER_TABS.map((tab) => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab(tab.key)}
              className="flex-1 text-xs"
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="p-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))
        ) : filtered.length > 0 ? (
          filtered.map((stop: DeliveryStop) => (
            <DeliveryStopCard key={stop.id} stop={stop} tripId={tripId} />
          ))
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No stops match the filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
