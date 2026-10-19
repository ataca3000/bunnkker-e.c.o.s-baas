import { Loader2 } from 'lucide-react';

/**
 * Centered full-screen loading indicator, shown while the auth session is
 * being restored.
 */
export function FullScreenLoader() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <Loader2 className="text-muted-foreground size-6 animate-spin" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
