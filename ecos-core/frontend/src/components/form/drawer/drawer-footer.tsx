import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DrawerFooterAction } from '../types';

type DrawerFooterProps = {
  /**
   * Cancel action on the left.
   * Renders a ghost/outline "Cancel" button that closes the drawer.
   */
  onCancel?: () => void;
  cancelLabel?: string;
  /**
   * Optional content in the center zone — e.g. keyboard shortcut hint,
   * autosave status, or dirty indicator.
   */
  helperText?: ReactNode;
  /**
   * Secondary right-side action (e.g. "Save & New", "Save & Close").
   * Rendered to the left of the primary button.
   */
  secondary?: DrawerFooterAction;
  /**
   * Primary right-side action (e.g. "Save", "Create").
   * Should be the most prominent button.
   */
  primary?: DrawerFooterAction;
  className?: string;
};

function ActionButton({ action }: { action: DrawerFooterAction }) {
  const Icon = action.icon;
  const isLoading = action.loading ?? false;

  return (
    <Button
      type={action.type ?? 'button'}
      form={action.form}
      variant={action.variant ?? 'default'}
      disabled={action.disabled ?? isLoading}
      onClick={action.onClick}
    >
      {isLoading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : Icon ? (
        <Icon className="size-4" aria-hidden />
      ) : null}
      {action.label}
    </Button>
  );
}

/**
 * Standardized 3-zone drawer footer.
 *
 * Layout:
 *   [Cancel]          [helper text]          [Secondary] [Primary]
 *
 * Usage:
 *   <DrawerFooter
 *     onCancel={() => setOpen(false)}
 *     helperText={<span className="text-xs text-muted-foreground">Ctrl+S to save</span>}
 *     primary={{ label: 'Save', form: 'my-form', type: 'submit', loading: isPending }}
 *     secondary={{ label: 'Save & New', onClick: handleSaveAndNew }}
 *   />
 */
export function DrawerFooter({
  onCancel,
  cancelLabel = 'Cancel',
  helperText,
  secondary,
  primary,
  className,
}: DrawerFooterProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-4 py-3 sm:px-6',
        className,
      )}
    >
      {/* Left: Cancel */}
      {onCancel ? (
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="shrink-0"
        >
          {cancelLabel}
        </Button>
      ) : null}

      {/* Center: helper text */}
      {helperText ? (
        <div className="flex flex-1 items-center justify-center">
          {helperText}
        </div>
      ) : (
        <div className="flex-1" aria-hidden />
      )}

      {/* Right: secondary + primary */}
      <div className="flex shrink-0 items-center gap-2">
        {secondary ? <ActionButton action={secondary} /> : null}
        {primary ? <ActionButton action={primary} /> : null}
      </div>
    </div>
  );
}
