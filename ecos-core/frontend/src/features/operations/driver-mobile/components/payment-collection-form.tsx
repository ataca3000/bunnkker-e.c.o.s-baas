import { useState } from 'react';
import { useFormatter } from '@/hooks/use-formatter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PAYMENT_TYPE_LABELS } from '../types/driver-mobile';
import type { CollectPaymentPayload } from '../services/driver-mobile-service';

interface PaymentCollectionFormProps {
  onSubmit: (payload: CollectPaymentPayload) => void;
  onCancel: () => void;
  isLoading?: boolean;
  defaultAmount?: number;
}

export function PaymentCollectionForm({
  onSubmit,
  onCancel,
  isLoading,
  defaultAmount,
}: PaymentCollectionFormProps) {
  const { currency } = useFormatter();
  const [paymentType, setPaymentType] = useState('cash');
  const [amount, setAmount]           = useState(defaultAmount?.toString() ?? '');
  const [reference, setReference]     = useState('');
  const [notes, setNotes]             = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      payment_type:     paymentType,
      amount:           parseFloat(amount),
      reference_number: reference || undefined,
      notes:            notes || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Payment Method</Label>
        <Select value={paymentType} onValueChange={setPaymentType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PAYMENT_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Amount ({currency}) *</Label>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          required
        />
      </div>

      {paymentType === 'bank_transfer' && (
        <div className="space-y-1.5">
          <Label>Reference Number</Label>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Transaction reference..."
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes..."
          rows={2}
        />
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Record Payment'}
        </Button>
      </div>
    </form>
  );
}
