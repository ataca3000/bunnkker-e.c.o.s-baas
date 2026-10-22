import { useRef, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

export type EcosTagsInputProps = {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  maxTags?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
};

const containerSizeClass = {
  sm: 'min-h-7 px-2 py-1 gap-1 text-xs',
  md: 'min-h-9 px-3 py-1.5 gap-1.5 text-sm',
  lg: 'min-h-10 px-4 py-2 gap-2 text-base',
};

const tagSizeClass = {
  sm: 'h-4 px-1.5 text-[10px]',
  md: 'h-5 px-2 text-xs',
  lg: 'h-6 px-2.5 text-xs',
};

/**
 * Multi-value tags input. Press Enter or comma to add a tag.
 * Backspace on empty input removes the last tag.
 */
export function EcosTagsInput({
  value,
  onChange,
  placeholder = 'Add tag…',
  disabled,
  maxTags,
  className,
  size = 'md',
}: EcosTagsInputProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || value.includes(tag)) return;
    if (maxTags && value.length >= maxTags) return;
    onChange([...value, tag]);
    setInput('');
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={cn(
        'flex flex-wrap items-center w-full rounded-md border border-input bg-transparent shadow-xs cursor-text',
        'transition-[color,box-shadow]',
        'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
        'aria-invalid:border-destructive',
        disabled && 'cursor-not-allowed opacity-50',
        containerSizeClass[size],
        className,
      )}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className={cn(
            'inline-flex items-center gap-1 rounded bg-secondary text-secondary-foreground font-medium',
            tagSizeClass[size],
          )}
        >
          {tag}
          {!disabled && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
              aria-label={`Remove ${tag}`}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-2.5" />
            </button>
          )}
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        disabled={disabled}
        placeholder={value.length === 0 ? placeholder : undefined}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (input.trim()) addTag(input); }}
        className="flex-1 min-w-24 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
      />
    </div>
  );
}
