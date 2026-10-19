import { Clock, HelpCircle, Monitor, User } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { usePosStore } from '@/features/pos/store/pos-store';
import type { PosMode } from '@/features/pos/types';

const MODE_LABELS: Record<PosMode, string> = {
  sale:     'Sale',
  return:   'Return',
  exchange: 'Exchange',
  manager:  'Manager',
};

const MODE_COLORS: Record<PosMode, string> = {
  sale:     'bg-emerald-500 text-white',
  return:   'bg-amber-500 text-white',
  exchange: 'bg-blue-500 text-white',
  manager:  'bg-purple-500 text-white',
};

type PosHeaderProps = {
  onModeChange: (mode: PosMode) => void;
};

export function PosHeader({ onModeChange }: PosHeaderProps) {
  const { terminalId, cashierName, mode, toggleKeyboardHelp } = usePosStore();
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const modes: PosMode[] = ['sale', 'return', 'exchange', 'manager'];

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-3">
      {/* Terminal info */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Monitor className="size-3.5" />
        <span className="font-mono">{terminalId}</span>
      </div>

      <div className="h-4 w-px bg-border" />

      {/* Mode buttons — min 44px touch targets */}
      <div className="flex items-center gap-1">
        {modes.map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            aria-pressed={mode === m}
            className={cn(
              'flex min-h-11 items-center rounded px-3 text-xs font-semibold transition-colors',
              mode === m ? MODE_COLORS[m] : 'text-muted-foreground hover:bg-accent',
            )}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {/* Cashier */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <User className="size-3.5" />
        <span>{cashierName || 'Cashier'}</span>
      </div>

      {/* Current mode badge */}
      <Badge className={cn('text-[10px]', MODE_COLORS[mode])}>
        {MODE_LABELS[mode]}
      </Badge>

      {/* Clock */}
      <div className="flex items-center gap-1 font-mono text-xs tabular-nums text-muted-foreground">
        <Clock className="size-3.5" />
        {time.toLocaleTimeString()}
      </div>

      {/* Keyboard help */}
      <Button
        variant="ghost"
        size="icon"
        className="min-h-11 min-w-11"
        title="Keyboard shortcuts (?)"
        onClick={toggleKeyboardHelp}
      >
        <HelpCircle className="size-4" />
      </Button>
    </header>
  );
}
