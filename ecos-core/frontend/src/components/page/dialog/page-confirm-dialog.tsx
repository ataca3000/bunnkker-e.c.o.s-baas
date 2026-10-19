import type { ReactNode } from 'react';

import { ConfirmDialog } from '@/components/crud/confirm-dialog';

type PageConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  loading?: boolean;
  variant?: 'default' | 'destructive';
};

/**
 * Standardized confirmation dialog for ERP pages.
 * Thin wrapper over ConfirmDialog — use this instead of importing directly
 * from the crud kit so the page layer has a single dependency.
 *
 * Usage:
 *   <PageConfirmDialog
 *     open={deleting !== null}
 *     onOpenChange={(open) => { if (!open) setDeleting(null); }}
 *     title="Delete order?"
 *     description="This action cannot be undone."
 *     confirmLabel="Delete"
 *     variant="destructive"
 *     loading={mutation.isPending}
 *     onConfirm={handleDelete}
 *   />
 */
export function PageConfirmDialog(props: PageConfirmDialogProps) {
  return <ConfirmDialog {...props} />;
}
