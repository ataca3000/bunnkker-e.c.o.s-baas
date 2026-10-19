import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History, Play, SkipBack, SkipForward } from 'lucide-react';

interface Props {
  entityType: string;
  entityId: string;
  onOpenDrawer?: () => void;
}

/**
 * PATCH-CORE-001 — Replay Controls Placeholder.
 * Renders a minimal replay toolbar to reserve the UX slot.
 * Wired to open the ReplayDrawerPlaceholder.
 */
export function ReplayControlsPlaceholder({ entityType, entityId, onOpenDrawer }: Props) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border bg-muted/20 px-2 py-1">
      <History className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground font-medium">Replay</span>
      <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
        Beta
      </Badge>
      <div className="flex items-center gap-0.5 ml-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          disabled
          title="Rewind to start"
        >
          <SkipBack className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onOpenDrawer}
          title={`Replay ${entityType} ${entityId.slice(0, 8)}…`}
        >
          <Play className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          disabled
          title="Fast-forward to latest"
        >
          <SkipForward className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
