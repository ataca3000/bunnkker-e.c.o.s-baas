import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Phone } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ds/use-toast';

import type { Order } from '../types/order';
import { useConfirmCustomer } from '../hooks/use-orders';

type Props = {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const COMMUNICATION_METHODS = [
  { value: 'phone',    label: 'Phone Call' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms',      label: 'SMS' },
  { value: 'email',    label: 'Email' },
];

const RESULTS = [
  { value: 'confirmed',    label: 'Confirmed' },
  { value: 'not_answered', label: 'Not Answered' },
  { value: 'rejected',     label: 'Rejected' },
  { value: 'postponed',    label: 'Postponed' },
];

export function OrderConfirmCustomerDialog({ order, open, onOpenChange }: Props) {
  const { t } = useTranslation('orders');
  const { toast } = useToast();
  const { mutate, isPending } = useConfirmCustomer();

  const [method, setMethod]   = useState<string>('phone');
  const [result, setResult]   = useState<string>('confirmed');
  const [notes, setNotes]     = useState<string>('');

  if (!order) return null;

  function handleSubmit() {
    if (!order) return;
    mutate(
      { id: order.id, communication_method: method, result, notes: notes || undefined },
      {
        onSuccess: () => {
          toast({ title: t($ => $.confirmation.success, { defaultValue: 'Confirmation recorded' }), description: t($ => $.confirmation.successDesc, { defaultValue: 'Customer confirmation has been saved.' }) });
          onOpenChange(false);
          setNotes('');
          setMethod('phone');
          setResult('confirmed');
        },
        onError: () => {
          toast({ title: t($ => $.confirmation.error, { defaultValue: 'Failed to save' }), variant: 'destructive' });
        },
      },
    );
  }

  const customerName = order.customer?.name ?? order.billing_first_name ?? '—';
  const customerPhone = order.customer?.phone ?? order.billing_phone ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="size-4 text-muted-foreground" />
            {t($ => $.confirmation.title, { defaultValue: 'Confirm with Customer' })}
          </DialogTitle>
          <DialogDescription>
            {customerName}
            {customerPhone ? (
              <span className="ml-2 font-medium text-foreground">{customerPhone}</span>
            ) : null}
            {' — '}
            <span className="font-mono text-xs">{order.order_number}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>{t($ => $.confirmation.method, { defaultValue: 'Communication Method' })}</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMUNICATION_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t($ => $.confirmation.result, { defaultValue: 'Result' })}</Label>
            <Select value={result} onValueChange={setResult}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESULTS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t($ => $.confirmation.notes, { defaultValue: 'Notes' })} <span className="text-muted-foreground text-xs">({t($ => $.common.optional, { defaultValue: 'optional' })})</span></Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t($ => $.confirmation.notesPlaceholder, { defaultValue: 'e.g. customer requested to call back tomorrow' })}
              rows={3}
              maxLength={1000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t($ => $.workspace.cancel, { defaultValue: 'Cancel' })}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? t($ => $.confirmation.saving, { defaultValue: 'Saving…' }) : t($ => $.confirmation.save, { defaultValue: 'Save Confirmation' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
