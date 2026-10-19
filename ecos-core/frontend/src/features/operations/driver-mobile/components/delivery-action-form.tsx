import { useState } from 'react';
import { useFormatter } from '@/hooks/use-formatter';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DeliveryActionType } from '../types/driver-mobile';
import { ACTION_TYPE_LABELS, PAYMENT_TYPE_LABELS } from '../types/driver-mobile';
import type { DeliveryActionPayload } from '../services/driver-mobile-service';

interface DeliveryActionFormProps {
  actionType: DeliveryActionType;
  onSubmit: (payload: DeliveryActionPayload) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const REQUIRES_REASON: DeliveryActionType[] = ['refused', 'not_available', 'wrong_address', 'unreachable'];
const REQUIRES_DATE:   DeliveryActionType[] = ['delay'];
const REQUIRES_PAYMENT: DeliveryActionType[] = ['completed', 'partial'];

export function DeliveryActionForm({
  actionType,
  onSubmit,
  onCancel,
  isLoading,
}: DeliveryActionFormProps) {
  const { currency } = useFormatter();
  const [reason, setReason]           = useState('');
  const [notes, setNotes]             = useState('');
  const [newDate, setNewDate]         = useState('');
  const [paymentType, setPaymentType] = useState('cash');
  const [amount, setAmount]           = useState('');
  const [reference, setReference]     = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload: DeliveryActionPayload = {
      action_type: actionType,
      reason:      reason || undefined,
      notes:       notes || undefined,
      new_delivery_date: newDate || undefined,
    };

    if (REQUIRES_PAYMENT.includes(actionType) && amount) {
      payload.payment_type     = paymentType;
      payload.payment_amount   = parseFloat(amount);
      payload.reference_number = reference || undefined;
    }

    onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="font-semibold text-sm">
        {ACTION_TYPE_LABELS[actionType]}
      </p>

      {/* Reason */}
      {REQUIRES_REASON.includes(actionType) && (
        <div className="space-y-1.5">
          <Label htmlFor="reason">Reason *</Label>
          <Input
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Brief reason..."
            required
          />
        </div>
      )}

      {/* Reschedule date */}
      {REQUIRES_DATE.includes(actionType) && (
        <div className="space-y-1.5">
          <Label htmlFor="new-date">New Delivery Date *</Label>
          <Input
            id="new-date"
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            required
          />
        </div>
      )}

      {/* Payment */}
      {REQUIRES_PAYMENT.includes(actionType) && (
        <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
          <p className="text-sm font-medium">Collect Payment</p>

          <div className="space-y-1.5">
            <Label htmlFor="pay-type">Payment Method</Label>
            <Select value={paymentType} onValueChange={setPaymentType}>
              <SelectTrigger id="pay-type">
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
            <Label htmlFor="pay-amount">Amount ({currency})</Label>
            <Input
              id="pay-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {paymentType === 'bank_transfer' && (
            <div className="space-y-1.5">
              <Label htmlFor="ref">Reference Number</Label>
              <Input
                id="ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Transaction reference..."
              />
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes..."
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Confirm'}
        </Button>
      </div>
    </form>
  );
}
