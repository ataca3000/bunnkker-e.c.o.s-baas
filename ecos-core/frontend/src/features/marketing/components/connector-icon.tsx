import { cn } from '@/lib/utils';
import type { ConnectorType } from '../types/marketing';

// Simple coloured initials badge — no external SVG dependencies
const CONNECTOR_CONFIG: Record<ConnectorType, { label: string; bg: string; text: string }> = {
  meta:        { label: 'M',  bg: 'bg-blue-600',   text: 'text-white' },
  google_ads:  { label: 'G',  bg: 'bg-red-500',    text: 'text-white' },
  tiktok:      { label: 'TT', bg: 'bg-black',       text: 'text-white' },
  snapchat:    { label: 'SC', bg: 'bg-yellow-400',  text: 'text-black' },
  linkedin:    { label: 'in', bg: 'bg-blue-700',   text: 'text-white' },
  pinterest:   { label: 'P',  bg: 'bg-red-600',    text: 'text-white' },
  x_ads:       { label: 'X',  bg: 'bg-gray-900',   text: 'text-white' },
};

interface Props {
  connector: ConnectorType;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASS = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
};

export function ConnectorIcon({ connector, size = 'md', className }: Props) {
  const cfg = CONNECTOR_CONFIG[connector];

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-bold',
        cfg.bg,
        cfg.text,
        SIZE_CLASS[size],
        className,
      )}
    >
      {cfg.label}
    </span>
  );
}
