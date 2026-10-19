import type { ReactNode } from 'react';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

type FormSectionProps = {
  title?: string;
  description?: string;
  /** Renders an expand/collapse toggle next to the title. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
};

/**
 * Logical grouping for form fields.
 *
 * Replaces the inconsistent mix of:
 *   - `<Card><CardHeader><CardTitle>` (Order form)
 *   - `<div className="flex flex-col gap-4">` (Supplier/Customer form)
 *
 * Usage:
 *   <FormSection title="Basic Information" description="Required fields">
 *     <FormGrid>
 *       <FormFieldWrapper name="code" label="Code" required>
 *         <Input {...register('code')} />
 *       </FormFieldWrapper>
 *     </FormGrid>
 *   </FormSection>
 *
 *   <FormSection title="Contact Details" collapsible defaultOpen={false}>
 *     ...
 *   </FormSection>
 */
export function FormSection({
  title,
  description,
  collapsible = false,
  defaultOpen = true,
  children,
  className,
}: FormSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const hasHeader = Boolean(title || description);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {hasHeader ? (
        <div
          className={cn(
            'flex items-start justify-between gap-2',
            collapsible && 'cursor-pointer select-none',
          )}
          onClick={collapsible ? () => setOpen((v) => !v) : undefined}
          role={collapsible ? 'button' : undefined}
          aria-expanded={collapsible ? open : undefined}
          tabIndex={collapsible ? 0 : undefined}
          onKeyDown={
            collapsible
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setOpen((v) => !v);
                  }
                }
              : undefined
          }
        >
          <div className="flex flex-col gap-0.5">
            {title ? (
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            ) : null}
            {description ? (
              <p className="text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>

          {collapsible ? (
            <ChevronDown
              className={cn(
                'mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                !open && '-rotate-90',
              )}
              aria-hidden
            />
          ) : null}
        </div>
      ) : null}

      {(!collapsible || open) ? (
        <div className="flex flex-col gap-4">{children}</div>
      ) : null}
    </div>
  );
}
