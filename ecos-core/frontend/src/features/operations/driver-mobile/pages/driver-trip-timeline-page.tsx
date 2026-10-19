import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/router/routes';
import { useTripTimeline } from '../hooks/use-driver-mobile';
import { DriverTripTimeline } from '../components/driver-trip-timeline';

export function DriverTripTimelinePage() {
  const { tripId = '' } = useParams<{ tripId: string }>();
  const navigate = useNavigate();

  const { data: timeline, isLoading } = useTripTimeline(tripId);

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(ROUTES.driverTrip.replace(':tripId', tripId))}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold text-base">Trip Timeline</h1>
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : timeline ? (
          <DriverTripTimeline events={timeline.events} />
        ) : (
          <p className="text-center text-sm text-muted-foreground py-12">
            No events yet.
          </p>
        )}
      </div>
    </div>
  );
}
