import { cn } from '@/lib/utils';

type Props = {
  method: string | null;
  methodTitle: string | null;
  datePaid: string | null;
};

type BadgeVariant = {
  label: string;
  className: string;
};

const METHOD_MAP: Record<string, BadgeVariant> = {
  cod:         { label: 'COD',    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  cash:        { label: 'Cash',   className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  visa:        { label: 'Visa',   className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  credit_card: { label: 'Card',   className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  bank:        { label: 'Bank',   className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  instalment:  { label: 'Inst.',  className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  wallet:      { label: 'Wallet', className: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
};

function resolveMethod(method: string | null, methodTitle: string | null): BadgeVariant {
  const key = (method ?? '').toLowerCase();
  const title = (methodTitle ?? method ?? '').toLowerCase();

  for (const [k, v] of Object.entries(METHOD_MAP)) {
    if (key.includes(k) || title.includes(k)) return v;
  }

  const display = methodTitle ?? method;
  if (!display) return { label: '—', className: 'text-muted-foreground' };

  // Capitalize first letter; keep short
  const label = display.length > 8 ? display.slice(0, 7) + '…' : display;
  return {
    label: label.charAt(0).toUpperCase() + label.slice(1),
    className: 'bg-muted text-muted-foreground',
  };
}

export function OrderPaymentBadge({ method, methodTitle, datePaid }: Props) {
  const badge = resolveMethod(method, methodTitle);
  const isPaid = Boolean(datePaid);

  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={cn(
          'inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none',
          badge.className,
        )}
      >
        {badge.label}
      </span>
      <span
        className={cn(
          'text-[9px] font-medium leading-none',
          isPaid
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-amber-600 dark:text-amber-400',
        )}
      >
        {isPaid ? '✓ Paid' : '○ Unpaid'}
      </span>
    </div>
  );
}
