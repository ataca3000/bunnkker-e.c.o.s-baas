import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type UnsavedChangesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user confirms they want to discard changes and close. */
  onDiscard: () => void;
  /** Called when the user wants to stay and keep editing. Defaults to closing the dialog. */
  onKeepEditing?: () => void;
  title?: string;
  description?: string;
  discardLabel?: string;
  keepEditingLabel?: string;
};

/**
 * Confirmation dialog shown when a user tries to close a drawer with
 * unsaved (dirty) form changes.
 *
 * Wire up with react-hook-form's `formState.isDirty`:
 *
 *   const [confirmClose, setConfirmClose] = useState(false);
 *   const { formState: { isDirty } } = form;
 *
 *   const handleClose = () => {
 *     if (isDirty) { setConfirmClose(true); return; }
 *     onOpenChange(false);
 *   };
 *
 *   <PageFormDrawer onOpenChange={handleClose} ...>
 *     ...
 *   </PageFormDrawer>
 *
 *   <UnsavedChangesDialog
 *     open={confirmClose}
 *     onOpenChange={setConfirmClose}
 *     onDiscard={() => { setConfirmClose(false); onOpenChange(false); }}
 *   />
 */
export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onDiscard,
  onKeepEditing,
  title = 'Discard changes?',
  description = 'You have unsaved changes. If you close now, your changes will be lost.',
  discardLabel = 'Discard changes',
  keepEditingLabel = 'Keep editing',
}: UnsavedChangesDialogProps) {
  const handleKeepEditing = () => {
    if (onKeepEditing) {
      onKeepEditing();
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
              <AlertTriangle className="size-5" aria-hidden />
            </span>
            <div className="flex flex-col gap-1 pt-1">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleKeepEditing}
          >
            {keepEditingLabel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onDiscard}
          >
            {discardLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
