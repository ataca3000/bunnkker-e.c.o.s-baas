import { useState } from 'react';
import { useFormatter } from '@/hooks/use-formatter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CollectPaymentPayload } from '../services/driver-mobile-service';

interface BankTransferFormProps {
  onSubmit: (payload: CollectPaymentPayload) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function BankTransferForm({ onSubmit, onCancel, isLoading }: BankTransferFormProps) {
  const { currency } = useFormatter();
  const [amount, setAmount]       = useState('');
  const [reference, setReference] = useState('');
  const [imageUrl, setImageUrl]   = useState('');
  const [notes, setNotes]         = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      payment_type:     'bank_transfer',
      amount:           parseFloat(amount),
      reference_number: reference || undefined,
      image_path:       imageUrl || undefined,
      notes:            notes || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

      <div className="space-y-1.5">
        <Label>Reference Number *</Label>
        <Input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Bank transaction reference..."
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label>Receipt Image URL</Label>
        <Input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://... (upload link)"
        />
        <p className="text-xs text-muted-foreground">
          Enter the URL of the uploaded receipt image.
        </p>
      </div>

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
          {isLoading ? 'Saving...' : 'Record Transfer'}
        </Button>
      </div>
    </form>
  );
}
