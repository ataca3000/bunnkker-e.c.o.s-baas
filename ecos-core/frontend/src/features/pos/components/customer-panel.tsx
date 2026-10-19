import { useEffect, useRef, useState } from 'react';
import { Loader2, User, X, Phone, Hash } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { usePosStore } from '@/features/pos/store/pos-store';
import { useCustomerSearch, useSetCartCustomer } from '@/features/pos/hooks/use-pos-queries';

type CustomerPanelProps = {
  className?: string;
};

export function CustomerPanel({ className }: CustomerPanelProps) {
  const { activeCustomerId, activeCustomerName, cartId, setCustomer, customerSearchTick } = usePosStore();
  const setCartCustomer = useSetCartCustomer();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Ctrl+K — expand and focus customer search
  useEffect(() => {
    if (customerSearchTick === 0) return;
    setExpanded(true);
    // Input auto-focuses when expanded, but the state update needs a tick
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [customerSearchTick]);  

  // 300ms debounce
  useEffect(() => {
    if (!search) { setDebouncedSearch(''); return; }
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: customers, isFetching } = useCustomerSearch(debouncedSearch);
  const results = customers ?? [];
  const showDropdown = expanded && debouncedSearch.length >= 2;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setExpanded(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function clearCustomer() {
    setCustomer(null, null);
    setSearch('');
    setDebouncedSearch('');
    setExpanded(false);
    if (cartId) setCartCustomer.mutate({ cartId, customerId: null });
  }

  function selectCustomer(id: string, name: string) {
    setCustomer(id, name);
    setSearch('');
    setDebouncedSearch('');
    setExpanded(false);
    if (cartId) setCartCustomer.mutate({ cartId, customerId: id });
  }

  // Active customer badge
  if (activeCustomerId) {
    return (
      <div className={cn('flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5', className)}>
        <User className="size-3.5 shrink-0 text-primary" />
        <span className="flex-1 truncate text-xs font-medium">{activeCustomerName}</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground hover:text-destructive"
          title="Remove customer"
          onClick={clearCustomer}
        >
          <X className="size-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      {expanded ? (
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, phone, code, or email…"
              className="h-7 pr-7 text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setExpanded(false); setSearch(''); }
                if (e.key === 'Enter' && results.length === 1) {
                  selectCustomer(results[0].id, results[0].name);
                }
              }}
            />
            {isFetching && (
              <Loader2 className="absolute right-2 top-1/2 size-3 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={() => { setExpanded(false); setSearch(''); }}
          >
            <X className="size-3" />
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-muted-foreground"
          onClick={() => setExpanded(true)}
        >
          <User className="size-3.5" />
          Add Customer
        </Button>
      )}

      {/* Dropdown results */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-8 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-md border bg-popover shadow-md"
        >
          {results.length === 0 && !isFetching ? (
            <div className="px-3 py-3 text-xs text-muted-foreground text-center">
              No customers found
            </div>
          ) : (
            results.map((customer) => (
              <button
                key={customer.id}
                className="flex w-full items-center gap-2 px-3 py-2 text-start hover:bg-accent focus-visible:bg-accent outline-none"
                onClick={() => selectCustomer(customer.id, customer.name)}
              >
                <User className="size-3.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{customer.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {customer.code && (
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Hash className="size-2.5" />{customer.code}
                      </span>
                    )}
                    {customer.phone && (
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Phone className="size-2.5" />{customer.phone}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
