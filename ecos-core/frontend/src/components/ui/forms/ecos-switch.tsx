import { type ReactNode } from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';

import { cn } from '@/lib/utils';

export type EcosSwitchProps = React.ComponentProps<typeof SwitchPrimitive.Root> & {
  label?: ReactNode;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
};

const rootSizeClass = {
  sm: 'h-4 w-7',
  md: 'h-5 w-9',
  lg: 'h-6 w-11',
};

const thumbSizeClass = {
  sm: 'size-3 data-[state=checked]:translate-x-3',
  md: 'size-4 data-[state=checked]:translate-x-4',
  lg: 'size-5 data-[state=checked]:translate-x-5',
};

export function EcosSwitch({ label, description, size = 'md', className, disabled, ...props }: EcosSwitchProps) {
  const control = (
    <SwitchPrimitive.Root
      disabled={disabled}
      className={cn(
        'peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-xs',
        'transition-all outline-none',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
        'dark:data-[state=unchecked]:bg-input/80',
        'disabled:cursor-not-allowed disabled:opacity-50',
        rootSizeClass[size],
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block rounded-full bg-background ring-0 transition-transform',
          'dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground',
          'data-[state=unchecked]:translate-x-0',
          thumbSizeClass[size],
        )}
      />
    </SwitchPrimitive.Root>
  );

  if (!label) return control;

  return (
    <div className={cn('flex items-start justify-between gap-3', disabled && 'opacity-50')}>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium leading-none">{label}</span>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </div>
      {control}
    </div>
  );
}
