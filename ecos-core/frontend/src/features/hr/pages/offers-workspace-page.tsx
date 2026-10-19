import { useState } from 'react';

import { ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/crud';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useOfferQuery,
  useOfferTransitionMutation,
  useOffersQuery,
} from '@/features/hr/hooks/use-hr-enhancements';
import type { OfferVersionEntry } from '@/features/hr/types/recruitment-enhancements';

const STATUS_TONE: Record<string, string> = {
  draft: 'neutral',
  sent: 'info',
  accepted: 'success',
  declined: 'danger',
  expired: 'warning',
  withdrawn: 'neutral',
};

/**
 * Offer letters.
 *
 * The version history is the point of this screen: an offer that was negotiated
 * up shows both numbers, because the company may have to prove it said the first
 * one before it said the second.
 */
export function OffersWorkspacePage() {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const { data: offers, isLoading, isError, refetch } = useOffersQuery({ status });
  const { data: detail } = useOfferQuery(selectedId);
  const transition = useOfferTransitionMutation();

  if (isLoading) return <LoadingState />;
  if (isError || !offers) return <ErrorState onRetry={() => void refetch()} />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Offers"
        subtitle="Hiring runs through here — an employee record is only created once an offer has been accepted."
        actions={
          <select
            value={status ?? ''}
            onChange={(e) => setStatus(e.target.value || undefined)}
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
          >
            <option value="">All statuses</option>
            {['draft', 'sent', 'accepted', 'declined', 'expired', 'withdrawn'].map((value) => (
              <option key={value} value={value}>
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Offers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-xs uppercase">
                    <th className="py-2 pr-4 font-medium">Number</th>
                    <th className="py-2 pr-4 font-medium">Candidate</th>
                    <th className="py-2 pr-4 font-medium">Salary</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 font-medium">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-muted-foreground py-6 text-center">
                        No offers yet.
                      </td>
                    </tr>
                  )}
                  {offers.map((offer) => (
                    <tr
                      key={offer.id}
                      onClick={() => setSelectedId(offer.id)}
                      className={`hover:bg-muted/50 cursor-pointer border-b last:border-0 ${
                        selectedId === offer.id ? 'bg-muted/60' : ''
                      }`}
                    >
                      <td className="py-2 pr-4 font-mono text-xs">{offer.offer_number}</td>
                      <td className="py-2 pr-4">{offer.candidate_name ?? '—'}</td>
                      <td className="py-2 pr-4 tabular-nums">
                        {offer.basic_salary.toLocaleString()} {offer.currency}
                        {offer.current_version > 1 && (
                          <span className="text-muted-foreground ml-1 text-xs">v{offer.current_version}</span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        <StatusBadge status={STATUS_TONE[offer.status] ?? 'neutral'} label={offer.status_label} />
                      </td>
                      <td className="py-2 text-xs">
                        {offer.expires_on ?? '—'}
                        {offer.has_lapsed && <span className="text-destructive ml-1">lapsed</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{detail ? `${detail.offer_number} — version ${detail.current_version}` : 'Select an offer'}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!detail && <p className="text-muted-foreground text-sm">Pick an offer to see its terms and history.</p>}

            {detail && (
              <>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <Term label="Candidate" value={detail.terms?.candidate_name} />
                  <Term label="Position" value={detail.terms?.position} />
                  <Term label="Department" value={detail.terms?.department} />
                  <Term label="Branch" value={detail.terms?.branch} />
                  <Term label="Employment type" value={detail.terms?.employment_type} />
                  <Term label="Start date" value={detail.terms?.start_date} />
                  <Term
                    label="Basic salary"
                    value={
                      detail.terms
                        ? `${detail.terms.basic_salary.toLocaleString()} ${detail.terms.currency}`
                        : undefined
                    }
                  />
                  <Term
                    label="Expires"
                    value={
                      detail.expires_on
                        ? `${detail.expires_on}${
                            detail.days_until_expiry !== null && detail.days_until_expiry !== undefined
                              ? ` (${detail.days_until_expiry} days)`
                              : ''
                          }`
                        : undefined
                    }
                  />
                </dl>

                {detail.terms?.notes && (
                  <p className="text-muted-foreground border-l-2 pl-3 text-sm">{detail.terms.notes}</p>
                )}

                <div className="flex flex-wrap gap-2">
                  {detail.status === 'draft' && (
                    <Button
                      size="sm"
                      disabled={transition.isPending}
                      onClick={() => transition.mutate({ id: detail.id, action: 'send' })}
                    >
                      Send
                    </Button>
                  )}
                  {detail.status === 'sent' && (
                    <>
                      <Button
                        size="sm"
                        disabled={transition.isPending}
                        onClick={() => transition.mutate({ id: detail.id, action: 'accept' })}
                      >
                        Record acceptance
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={transition.isPending}
                        onClick={() => transition.mutate({ id: detail.id, action: 'decline' })}
                      >
                        Record decline
                      </Button>
                    </>
                  )}
                  {(detail.status === 'draft' || detail.status === 'sent') && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={transition.isPending}
                      onClick={() =>
                        transition.mutate({ id: detail.id, action: 'withdraw', note: 'Withdrawn by the company' })
                      }
                    >
                      Withdraw
                    </Button>
                  )}
                </div>

                {detail.permits_hiring && (
                  <p className="text-sm">
                    <span className="font-medium">Accepted.</span> This candidacy can now be hired.
                  </p>
                )}

                <VersionHistory versions={detail.version_history} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Term({ label, value }: { label: string; value?: string | null }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value ?? '—'}</dd>
    </>
  );
}

/** What changed between revisions — the reason versions exist at all. */
function VersionHistory({ versions }: { versions: OfferVersionEntry[] }) {
  if (versions.length <= 1) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">Version history</h3>
      <ol className="flex flex-col gap-3">
        {versions.map((version) => (
          <li key={version.id} className="border-l-2 pl-3 text-sm">
            <div className="flex items-baseline gap-2">
              <span className="font-medium">Version {version.version}</span>
              {version.is_current && <span className="text-muted-foreground text-xs">current</span>}
              <span className="text-muted-foreground text-xs">{version.created_at}</span>
            </div>
            {version.revision_reason && <p className="text-muted-foreground">{version.revision_reason}</p>}
            {Object.entries(version.changes).length > 0 && (
              <ul className="text-muted-foreground mt-1 text-xs">
                {Object.entries(version.changes).map(([field, change]) => (
                  <li key={field}>
                    {field}: {String(change.from ?? '—')} → {String(change.to ?? '—')}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
