import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

/**
 * The small presentation primitives the Finance control workspaces share.
 *
 * These are layout only — no Finance semantics, no data access. They exist so
 * the treasury, fiscal, budget and tax pages lay out identically without each
 * re-deriving the same spacing, and so a change to that layout lands in one
 * place rather than four.
 */

/** A bordered section grouping one operation's fields and its action. */
export function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** A labelled control. `id` must match the control's own id for the label to bind. */
export function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

/** A single read-only figure. The value is rendered exactly as supplied. */
export function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: 'default' | 'warn' | 'danger';
}) {
  const toneClass =
    tone === 'danger' ? 'text-red-600' : tone === 'warn' ? 'text-amber-600' : undefined;

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-medium tabular-nums ${toneClass ?? ''}`}>{value}</p>
    </div>
  );
}

/** Shown when the viewer holds none of the permissions a workspace needs. */
export function NoAccess() {
  const { t } = useTranslation('finance');
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        {t(($) => $.noAccess)}
      </CardContent>
    </Card>
  );
}
