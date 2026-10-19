import { Check, Copy, MessageCircle, Phone } from 'lucide-react';
import { useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type PhoneCellLabels = {
  call?: string;
  whatsapp?: string;
  copy?: string;
  copied?: string;
};

const DEFAULT_LABELS: Required<PhoneCellLabels> = {
  call: 'Call',
  whatsapp: 'WhatsApp',
  copy: 'Copy',
  copied: 'Copied!',
};

type PhoneCellProps = {
  phone: string | null;
  labels?: PhoneCellLabels;
};

/**
 * Reusable phone cell: click to reveal Call / WhatsApp / Copy actions.
 * No i18n dependency — pass `labels` for translated text.
 * Used in: Orders, Customers, Suppliers, any table with a phone column.
 */
export function PhoneCell({ phone, labels }: PhoneCellProps) {
  const [copied, setCopied] = useState(false);
  const l = { ...DEFAULT_LABELS, ...labels };

  if (!phone) {
    return <span className="text-muted-foreground">—</span>;
  }

  const digits = phone.replace(/\D/g, '');

  const handleCopy = () => {
    void navigator.clipboard.writeText(phone).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          className="font-mono text-xs transition-colors underline-offset-2 hover:text-primary hover:underline"
        >
          {phone}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuItem asChild>
          <a href={`tel:${digits}`} className="flex items-center gap-2">
            <Phone className="size-3.5" />
            {l.call}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={`https://wa.me/${digits}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            <MessageCircle className="size-3.5" />
            {l.whatsapp}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopy}>
          {copied ? (
            <Check className="size-3.5 text-emerald-500" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied ? l.copied : l.copy}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
