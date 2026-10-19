import { RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * The "this data is not available right now" state.
 *
 * This is the Executive Platform's error card, extracted so the Dashboard can
 * use the same one rather than growing a second, slightly different version.
 * The Executive board already degraded correctly on a failed panel; the
 * Dashboard sat in a loading skeleton forever on the very same failure
 * (TASK-GL-HOTFIX-001), because it had no error branch at all.
 *
 * `message` and `retryLabel` are passed in rather than resolved here: i18next
 * runs in selector mode, so a component shared across namespaces cannot look up
 * its own keys. This matches how ExecutiveTrendPanel already takes `unavailable`.
 *
 * The layout is preserved on failure — a bordered card of the same footprint —
 * so the page does not reflow into a different shape when a panel fails.
 */
export function ExecutiveUnavailableCard({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  /** Required whenever `onRetry` is given — the button must never be unlabelled. */
  retryLabel?: string;
  onRetry?: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 pt-6 text-sm text-muted-foreground">
        <span>{message}</span>

        {onRetry && retryLabel && (
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={onRetry}>
            <RotateCcw className="size-3.5" aria-hidden />
            {retryLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
