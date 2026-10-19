import { forwardRef, useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type SearchInputProps = {
  /** Called with the debounced value. */
  onChange: (value: string) => void;
  placeholder?: string;
  initialValue?: string;
  debounceMs?: number;
  className?: string;
};

/**
 * Debounced search input with a clear button.
 * Supports ref forwarding so callers can programmatically focus the input
 * (e.g. for Ctrl+K / "/" keyboard shortcuts).
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput(
    { onChange, placeholder, initialValue = '', debounceMs = 300, className },
    ref,
  ) {
    const { t } = useTranslation('common');
    const [value, setValue] = useState(initialValue);
    const onChangeRef = useRef(onChange);
    const resolvedPlaceholder = placeholder ?? t($ => $.search.placeholder);

    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
      const timer = setTimeout(() => onChangeRef.current(value), debounceMs);
      return () => clearTimeout(timer);
    }, [value, debounceMs]);

    return (
      <div className={cn('relative w-full max-w-sm', className)}>
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 start-2.5 size-4 -translate-y-1/2" />
        <Input
          ref={ref}
          type="text"
          value={value}
          placeholder={resolvedPlaceholder}
          aria-label={resolvedPlaceholder}
          onChange={(event) => setValue(event.target.value)}
          className="pe-8 ps-8"
        />
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t($ => $.search.clear)}
            onClick={() => setValue('')}
            className="absolute top-1/2 end-1 size-7 -translate-y-1/2"
          >
            <X className="size-3.5" />
          </Button>
        ) : null}
      </div>
    );
  },
);
