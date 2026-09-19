'use client';

import React, { useState, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

interface DebouncedSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  delay?: number;
  className?: string;
  inputClassName?: string;
  iconClassName?: string;
  autoFocus?: boolean;
}

export function DebouncedSearchInput({
  value: externalValue,
  onChange,
  placeholder = 'Buscar por código, nombre...',
  delay = 250,
  className = '',
  inputClassName = '',
  iconClassName = '',
  autoFocus = false,
}: DebouncedSearchInputProps) {
  const [localValue, setLocalValue] = useState(externalValue);
  const debouncedValue = useDebounce(localValue, delay);

  // Sync external value changes (e.g. if parent clears search)
  useEffect(() => {
    setLocalValue(externalValue);
  }, [externalValue]);

  // Notify parent when debounced value updates
  useEffect(() => {
    if (debouncedValue !== externalValue) {
      onChange(debouncedValue);
    }
  }, [debouncedValue, onChange, externalValue]);

  const isPending = localValue !== debouncedValue;

  const handleClear = () => {
    setLocalValue('');
    onChange('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleClear();
    }
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <Search
        size={18}
        className={`absolute left-4 pointer-events-none transition-colors ${
          iconClassName || 'text-slate-400'
        }`}
      />
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={
          inputClassName ||
          'w-full bg-slate-800/80 border border-slate-700/50 pl-12 pr-10 py-3.5 rounded-2xl font-medium text-white placeholder-slate-400 outline-none focus:border-[#0ea5e9] focus:ring-1 focus:ring-[#0ea5e9] shadow-lg transition-all text-sm'
        }
      />
      <div className="absolute right-3.5 flex items-center gap-1.5">
        {isPending && (
          <Loader2 size={15} className="animate-spin text-cyan-400/80" />
        )}
        {localValue && (
          <button
            type="button"
            onClick={handleClear}
            className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-700/50 transition-colors"
            title="Limpiar búsqueda (Esc)"
          >
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
export default DebouncedSearchInput;
