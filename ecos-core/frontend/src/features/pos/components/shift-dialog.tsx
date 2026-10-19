import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Clock } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  useOpenShift,
  useCloseShift,
  useApproveShift,
  useRejectShift,
} from '@/features/pos/hooks/use-pos-queries';
import { usePosStore } from '@/features/pos/store/pos-store';

const moneySchema = z.object({
  amount:   z.string().min(1, 'Amount is required'),
  currency: z.string().length(3, 'Currency must be 3 characters'),
});

const openSchema = z.object({
  opening_cash: moneySchema,
});

const closeSchema = z.object({
  closing_count: moneySchema,
});

const approveSchema = z.object({
  expected_closing: moneySchema,
});

const rejectSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
});

type ShiftDialogProps = {
  open: boolean;
  mode: 'open' | 'close' | 'approve';
  onOpenChange: (open: boolean) => void;
};

export function ShiftDialog({ open, mode, onOpenChange }: ShiftDialogProps) {
  const { sessionId, shiftId, terminalId, cashierId, currency } = usePosStore();

  const openShift    = useOpenShift();
  const closeShift   = useCloseShift();
  const approveShift = useApproveShift();
  const rejectShift  = useRejectShift();

  const openForm    = useForm({ resolver: zodResolver(openSchema),    defaultValues: { opening_cash:     { amount: '0.00', currency } } });
  const closeForm   = useForm({ resolver: zodResolver(closeSchema),   defaultValues: { closing_count:    { amount: '0.00', currency } } });
  const approveForm = useForm({ resolver: zodResolver(approveSchema), defaultValues: { expected_closing: { amount: '0.00', currency } } });
  const rejectForm  = useForm({ resolver: zodResolver(rejectSchema),  defaultValues: { reason: '' } });

  async function handleOpen(data: z.infer<typeof openSchema>) {
    if (!sessionId) return;
    await openShift.mutateAsync({ session_id: sessionId, terminal_id: terminalId, cashier_id: cashierId, opening_cash: data.opening_cash });
    onOpenChange(false);
  }

  async function handleClose(data: z.infer<typeof closeSchema>) {
    if (!shiftId) return;
    await closeShift.mutateAsync({ id: shiftId, payload: data });
    onOpenChange(false);
  }

  async function handleApprove(data: z.infer<typeof approveSchema>) {
    if (!shiftId) return;
    await approveShift.mutateAsync({ id: shiftId, payload: data });
    onOpenChange(false);
  }

  async function handleReject(data: z.infer<typeof rejectSchema>) {
    if (!shiftId) return;
    await rejectShift.mutateAsync({ id: shiftId, payload: data });
    onOpenChange(false);
  }

  if (mode === 'open') {
    const errors = openForm.formState.errors;
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Clock className="size-5" />
              <DialogTitle>Open Shift</DialogTitle>
            </div>
          </DialogHeader>
          <form onSubmit={openForm.handleSubmit(handleOpen)} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Opening Cash ({currency})</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                {...openForm.register('opening_cash.amount')}
              />
              {errors.opening_cash?.amount && (
                <p className="text-xs text-destructive">{errors.opening_cash.amount.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={openShift.isPending}>
                {openShift.isPending ? 'Opening...' : 'Open Shift'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  if (mode === 'close') {
    const errors = closeForm.formState.errors;
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Close Shift</DialogTitle>
          </DialogHeader>
          <form onSubmit={closeForm.handleSubmit(handleClose)} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Closing Count ({currency})</Label>
              <Input type="number" min="0" step="0.01" {...closeForm.register('closing_count.amount')} />
              {errors.closing_count?.amount && (
                <p className="text-xs text-destructive">{errors.closing_count.amount.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={closeShift.isPending} variant="destructive">
                {closeShift.isPending ? 'Submitting...' : 'Submit for Approval'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  // Approve mode (manager screen)
  const approveErrors = approveForm.formState.errors;
  const rejectErrors  = rejectForm.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Approve Shift</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="approve">
          <TabsList className="w-full">
            <TabsTrigger value="approve" className="flex-1">Approve</TabsTrigger>
            <TabsTrigger value="reject" className="flex-1">Reject</TabsTrigger>
          </TabsList>

          <TabsContent value="approve">
            <form onSubmit={approveForm.handleSubmit(handleApprove)} className="space-y-3 pt-3">
              <div className="space-y-1.5">
                <Label>Expected Closing ({currency})</Label>
                <Input type="number" min="0" step="0.01" {...approveForm.register('expected_closing.amount')} />
                {approveErrors.expected_closing?.amount && (
                  <p className="text-xs text-destructive">{approveErrors.expected_closing.amount.message}</p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" disabled={approveShift.isPending}>
                  {approveShift.isPending ? 'Approving...' : 'Approve'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="reject">
            <form onSubmit={rejectForm.handleSubmit(handleReject)} className="space-y-3 pt-3">
              <div className="space-y-1.5">
                <Label>Rejection Reason</Label>
                <Input {...rejectForm.register('reason')} placeholder="Enter reason..." />
                {rejectErrors.reason && (
                  <p className="text-xs text-destructive">{rejectErrors.reason.message}</p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" variant="destructive" disabled={rejectShift.isPending}>
                  {rejectShift.isPending ? 'Rejecting...' : 'Reject Count'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
