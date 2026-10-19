import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class PosErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[POS] Uncaught render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-svh flex-col items-center justify-center gap-6 p-8 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">POS Error</h1>
            <p className="text-sm text-muted-foreground max-w-xs">
              An unexpected error occurred. Reload to continue.
            </p>
            <p className="font-mono text-xs text-destructive/80 max-w-sm truncate">
              {this.state.error.message}
            </p>
          </div>
          <Button onClick={() => window.location.reload()} className="gap-2">
            <RefreshCcw className="size-4" />
            Reload POS
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
