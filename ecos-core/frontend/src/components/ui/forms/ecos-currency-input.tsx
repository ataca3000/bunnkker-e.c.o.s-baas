import { forwardRef, useState } from 'react';
import { DEFAULT_CURRENCY } from '@/lib/format';

import { EcosInput, type EcosInputProps } from './ecos-input';

export type EcosCurrencyInputProps = Omit<EcosInputProps, 'type' | 'value' | 'onChange' | 'trailing'> & {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  currency?: string;
  decimals?: number;
  allowNegative?: boolean;
};

function formatNumber(n: number, decimals: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function parseRaw(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim();
  if (cleaned === '' || cleaned === '-') return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/**
 * Currency input with thousands separator, configurable decimals, and currency
 * symbol as a trailing badge. Formats on blur; shows raw value while editing.
 */
export const EcosCurrencyInput = forwardRef<HTMLInputElement, EcosCurrencyInputProps>(
  (
    {
      value,
      onChange,
      currency = DEFAULT_CURRENCY,
      decimals = 2,
      allowNegative = false,
      onFocus,
      onBlur,
      size = 'md',
      ...props
    },
    ref,
  ) => {
    const [focused, setFocused] = useState(false);

    const displayValue = focused
      ? (value == null ? '' : String(value))
      : (value == null ? '' : formatNumber(value, decimals));

    return (
      <EcosInput
        ref={ref}
        type="text"
        inputMode="decimal"
        size={size}
        value={displayValue}
        trailing={<span className="text-xs font-medium text-muted-foreground">{currency}</span>}
        onChange={(e) => {
          const raw = e.target.value;
          if (!allowNegative && raw.startsWith('-')) return;
          const parsed = parseRaw(raw);
          onChange(parsed);
        }}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...props}
      />
    );
  },
);

EcosCurrencyInput.displayName = 'EcosCurrencyInput';
