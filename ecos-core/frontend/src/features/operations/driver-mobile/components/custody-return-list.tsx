import { useState } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CustodyReturn } from '../types/driver-mobile';

interface CustodyReturnListProps {
  returns: CustodyReturn[];
  onConfirm?: (id: number, qty: number) => void;
  isConfirming?: boolean;
}

export function CustodyReturnList({ returns, onConfirm, isConfirming }: CustodyReturnListProps) {
  const [qtys, setQtys] = useState<Record<number, string>>({});

  if (returns.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-8">
        No custody items recorded yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {returns.map((item) => {
        const confirmed = item.confirmed_at !== null;
        return (
          <div key={item.id} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-sm">{item.custody_type}</p>
                <p className="text-xs text-muted-foreground">
                  Dispatched: {item.dispatched_qty} · Returned: {item.returned_qty ?? '—'}
                </p>
              </div>
              {confirmed ? (
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
              ) : item.driver_liable ? (
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
              ) : null}
            </div>

            {!confirmed && onConfirm && (
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  placeholder="Confirmed Qty"
                  value={qtys[item.id] ?? ''}
                  onChange={(e) => setQtys((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  disabled={isConfirming || !qtys[item.id]}
                  onClick={() => {
                    const q = parseFloat(qtys[item.id] ?? '0');
                    if (!isNaN(q)) onConfirm(item.id, q);
                  }}
                >
                  Confirm
                </Button>
              </div>
            )}

            {item.driver_liable && (
              <p className="text-xs text-red-600 font-medium">Driver is liable for the shortage</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
