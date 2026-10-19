import { CheckCircle, XCircle, AlertTriangle, Clock, Play, Flag } from 'lucide-react';
import type { TripTimelineEvent } from '../types/driver-mobile';

interface DriverTripTimelineProps {
  events: TripTimelineEvent[];
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  trip_started:    <Play className="h-4 w-4" />,
  stop_completed:  <CheckCircle className="h-4 w-4 text-green-600" />,
  stop_partial:    <AlertTriangle className="h-4 w-4 text-amber-600" />,
  stop_failed:     <XCircle className="h-4 w-4 text-red-600" />,
  stop_returned:   <AlertTriangle className="h-4 w-4 text-purple-600" />,
  exception:       <AlertTriangle className="h-4 w-4 text-orange-600" />,
  trip_finished:   <Flag className="h-4 w-4 text-green-700" />,
};

const EVENT_DOT: Record<string, string> = {
  trip_started:    'bg-blue-500',
  stop_completed:  'bg-green-500',
  stop_partial:    'bg-amber-500',
  stop_failed:     'bg-red-500',
  stop_returned:   'bg-purple-500',
  exception:       'bg-orange-500',
  trip_finished:   'bg-green-700',
};

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return ts;
  }
}

export function DriverTripTimeline({ events }: DriverTripTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-muted-foreground">
        <Clock className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-sm">No events yet</p>
      </div>
    );
  }

  return (
    <ol className="relative space-y-0">
      {events.map((event, idx) => (
        <li key={idx} className="relative flex gap-3 pb-6 last:pb-0">
          {/* Vertical line */}
          {idx < events.length - 1 && (
            <div className="absolute left-3.5 top-7 bottom-0 w-px bg-border" />
          )}

          {/* Dot */}
          <span
            className={`relative z-10 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${EVENT_DOT[event.type] ?? 'bg-gray-400'}`}
          >
            {EVENT_ICONS[event.type] ?? <Clock className="h-3.5 w-3.5" />}
          </span>

          {/* Content */}
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm font-medium">{event.label}</p>
            {event.notes && (
              <p className="text-xs text-muted-foreground">{event.notes}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">{formatTime(event.timestamp)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
