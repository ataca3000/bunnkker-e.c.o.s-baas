import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type ChannelBadgeProps = {
  name: string;
  className?: string;
};

export function ChannelBadge({ name, className }: ChannelBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700',
        'dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-400',
        className,
      )}
    >
      <Globe className="size-3 shrink-0" />
      {name}
    </span>
  );
}

type ChannelCellProps = {
  channels?: Array<{ id: string; name: string }>;
};

/** Renders up to 2 channel badges. Overflow count shows a tooltip listing all channels. */
export function ChannelCell({ channels }: ChannelCellProps) {
  const { t } = useTranslation('products');

  if (!channels || channels.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const visible = channels.slice(0, 2);
  const overflow = channels.slice(2);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((ch) => (
        <ChannelBadge key={ch.id} name={ch.name} />
      ))}
      {overflow.length > 0 && (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-default rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                +{overflow.length}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-64">
              <p className="text-xs font-medium mb-1 text-muted-foreground">{t($ => $.badges.allChannels)}</p>
              <p className="text-xs">
                {channels.map((ch) => ch.name).join(' • ')}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
