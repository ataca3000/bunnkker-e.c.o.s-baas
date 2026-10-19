import { useState } from 'react';

import { ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/crud';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useCompleteExitMutation,
  useExitItemMutation,
  useExitQuery,
  useOpenExitsQuery,
} from '@/features/hr/hooks/use-hr-enhancements';
import type { ExitChecklistItem } from '@/features/hr/types/recruitment-enhancements';

const ITEM_TONE: Record<string, string> = {
  pending: 'warning',
  completed: 'success',
  waived: 'info',
  not_applicable: 'neutral',
};

/**
 * Employee exit.
 *
 * The blocking items are named, not counted. "Three items outstanding" tells
 * nobody which door to knock on; "IT clearance — Ahmed Farouk, due Thursday"
 * does.
 */
export function ExitManagementPage() {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const { data: exits, isLoading, isError, refetch } = useOpenExitsQuery();
  const { data: detail } = useExitQuery(selectedId);
  const itemMutation = useExitItemMutation();
  const completeExit = useCompleteExitMutation();

  if (isLoading) return <LoadingState />;
  if (isError || !exits) return <ErrorState onRetry={() => void refetch()} />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Employee Exit"
        subtitle="An exit cannot be completed while a mandatory clearance item is outstanding."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <Card>
          <CardHeader>
            <CardTitle>Open exits</CardTitle>
          </CardHeader>
          <CardContent>
            {exits.length === 0 && <p className="text-muted-foreground text-sm">Nobody is currently leaving.</p>}
            <ul className="flex flex-col gap-2">
              {exits.map((exit) => (
                <li key={exit.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(exit.id)}
                    className={`hover:bg-muted/50 w-full rounded-md border p-3 text-left ${
                      selectedId === exit.id ? 'bg-muted/60' : ''
                    }`}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-medium">{exit.employee_name ?? exit.employee_number}</span>
                      <span className="text-muted-foreground font-mono text-xs">{exit.reference}</span>
                    </div>
                    <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <span>{exit.type_label}</span>
                      <span>·</span>
                      <span>Last day {exit.last_working_day ?? '—'}</span>
                      {exit.days_remaining !== null && exit.days_remaining !== undefined && (
                        <>
                          <span>·</span>
                          <span className={exit.days_remaining < 0 ? 'text-destructive' : ''}>
                            {exit.days_remaining < 0
                              ? `${Math.abs(exit.days_remaining)} days past`
                              : `${exit.days_remaining} days left`}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="bg-muted mt-2 h-1.5 w-full overflow-hidden rounded">
                      <div className="bg-primary h-full" style={{ width: `${exit.progress_percent}%` }} />
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {exit.progress_percent}% cleared
                      {exit.outstanding_mandatory > 0
                        ? ` · ${exit.outstanding_mandatory} mandatory item(s) blocking`
                        : ' · ready to complete'}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{detail ? `${detail.reference} — ${detail.employee?.name ?? ''}` : 'Select an exit'}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!detail && <p className="text-muted-foreground text-sm">Pick an exit to work its checklist.</p>}

            {detail && (
              <>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Type</dt>
                  <dd>
                    {detail.type_label} {detail.is_voluntary ? '(voluntary)' : ''}
                  </dd>
                  <dt className="text-muted-foreground">Notice date</dt>
                  <dd>{detail.notice_date ?? '—'}</dd>
                  <dt className="text-muted-foreground">Last working day</dt>
                  <dd>{detail.last_working_day ?? '—'}</dd>
                  <dt className="text-muted-foreground">Reason</dt>
                  <dd>{detail.reason ?? '—'}</dd>
                </dl>

                {detail.blocking_items.length > 0 && (
                  <div className="border-destructive/40 bg-destructive/5 rounded-md border p-3">
                    <p className="text-sm font-medium">
                      Cannot complete — {detail.blocking_items.length} mandatory item(s) outstanding
                    </p>
                    <ul className="mt-2 flex flex-col gap-1 text-sm">
                      {detail.blocking_items.map((item) => (
                        <li key={item.id} className="flex flex-wrap items-baseline gap-2">
                          <span>{item.label}</span>
                          <span className="text-muted-foreground text-xs">
                            {item.responsible ?? 'nobody assigned'}
                            {item.due_date ? ` · due ${item.due_date}` : ''}
                            {item.is_overdue ? ' · overdue' : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button
                  size="sm"
                  disabled={!detail.can_complete || completeExit.isPending}
                  onClick={() => completeExit.mutate({ id: detail.id })}
                  className="self-start"
                >
                  Complete exit
                </Button>

                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">Clearance checklist</h3>
                  {detail.checklist.map((item) => (
                    <ChecklistRow
                      key={item.id}
                      item={item}
                      busy={itemMutation.isPending}
                      onAction={(action, reason) => itemMutation.mutate({ itemId: item.id, action, reason })}
                    />
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ChecklistRow({
  item,
  busy,
  onAction,
}: {
  item: ExitChecklistItem;
  busy: boolean;
  onAction: (action: 'complete' | 'waive' | 'not_applicable' | 'reopen', reason?: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
      <div className="flex flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <span className={item.is_blocking ? 'font-medium' : ''}>{item.label}</span>
          {item.is_mandatory && <span className="text-muted-foreground text-[10px] uppercase">mandatory</span>}
          <StatusBadge status={ITEM_TONE[item.status] ?? 'neutral'} label={item.status_label} />
        </div>
        <span className="text-muted-foreground text-xs">
          {item.responsible_name ?? 'Unassigned'}
          {item.due_date ? ` · due ${item.due_date}` : ''}
          {item.is_overdue ? ' · overdue' : ''}
          {item.waiver_reason ? ` · waived: ${item.waiver_reason}` : ''}
        </span>
      </div>

      <div className="flex gap-1">
        {item.status === 'pending' ? (
          <>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction('complete')}>
              Done
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              // A waiver always carries a reason — that is what separates it from
              // quietly skipping the item.
              onClick={() => {
                const reason = window.prompt('Why is this mandatory item being waived?');
                if (reason && reason.trim() !== '') onAction('waive', reason);
              }}
            >
              Waive
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => onAction('not_applicable')}>
              N/A
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => onAction('reopen')}>
            Reopen
          </Button>
        )}
      </div>
    </div>
  );
}
