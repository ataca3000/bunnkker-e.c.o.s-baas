import { useEffect, useRef, useState } from 'react';
import { Search, UserCheck, UserX, Loader2 } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { useCustomerByPhone } from '@/features/orders/hooks/use-orders';
import type { CustomerLookupResult } from '@/features/orders/types/order';

type Props = {
  onFound: (result: CustomerLookupResult) => void;
  onNotFound: (phone: string) => void;
  onClear: () => void;
};

export function OrderCustomerLookupField({ onFound, onNotFound, onClear }: Props) {
  const [phone, setPhone] = useState('');
  const [debouncedPhone, setDebouncedPhone] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isFetching, isError } = useCustomerByPhone(debouncedPhone);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (phone.length < 8) {
      setDebouncedPhone('');
      onClear();
      return;
    }
    timerRef.current = setTimeout(() => setDebouncedPhone(phone), 500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // onClear changes reference on every render — intentionally exclude
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  useEffect(() => {
    if (!debouncedPhone || isFetching) return;
    if (data) {
      onFound(data);
    } else {
      onNotFound(debouncedPhone);
    }
  // Only fire when fetch resolves
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isFetching, debouncedPhone]);

  const statusIcon = isFetching ? (
    <Loader2 className="size-4 animate-spin text-muted-foreground" />
  ) : data ? (
    <UserCheck className="size-4 text-emerald-600" />
  ) : debouncedPhone && !isError ? (
    <UserX className="size-4 text-amber-500" />
  ) : (
    <Search className="size-4 text-muted-foreground" />
  );

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">
        Customer Phone <span className="text-destructive">*</span>
      </label>
      <div className="relative">
        <Input
          type="tel"
          placeholder="e.g. 01012345678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="pr-9"
          autoFocus
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2">{statusIcon}</span>
      </div>
      {debouncedPhone && !isFetching && (
        <p className={`text-xs ${data ? 'text-emerald-600' : 'text-amber-600'}`}>
          {data
            ? `Found: ${data.customer.name}`
            : 'No customer found — enter details below to create one.'}
        </p>
      )}
    </div>
  );
}
