import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EntityDrawer } from '@/components/crud/entity-drawer';
import { StatusBadge } from '@/components/crud/status-badge';
import type { StatusVariant } from '@/components/crud/types';
import { Tabs, type TabItem } from '@/components/ds';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/features/authorization';
import { CrmCustomerAnalyticsTab } from '@/features/crm/components/crm-customer-analytics-tab';
import {
  useCrmCustomerActivitiesQuery,
  useCrmCustomerIntelligenceQuery,
  useCrmCustomerProfileQuery,
  useCrmCustomerTimelineQuery,
} from '@/features/crm/hooks/use-crm-customers';
import type enCrm from '@/i18n/locales/en/crm.json';
import type {
  CrmCustomerProfile,
  CrmCustomerStatus,
  CrmTimelineEntry,
} from '@/features/crm/types/crm-customer';

/**
 * Customer details drawer — the CRM module's central interaction surface.
 *
 * ┌─ WHICH TABS EXIST, AND WHY ─────────────────────────────────────────────┐
 * │ Tabs are built from what the API can actually answer, not from a wish   │
 * │ list. Contact, addresses, notes and documents all come from the single  │
 * │ /profile call: those resources have POST endpoints but no list endpoint │
 * │ of their own, so profile is the only way to read them.                  │
 * │                                                                          │
 * │ Timeline and Activity have their own endpoints and are fetched lazily,  │
 * │ when their tab is first opened — otherwise opening the drawer would     │
 * │ fire every tab's request for tabs the user may never look at.           │
 * │                                                                          │
 * │ Orders, Loyalty, Analytics and record Permissions are NOT tabs here.    │
 * │ Orders and record-permissions have no CRM endpoint at all; loyalty is   │
 * │ addressed by accountId with no customer-to-account lookup exposed; and  │
 * │ customer intelligence lives under its own namespace. Rendering empty    │
 * │ shells for them would imply the data exists and is merely absent.       │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

type CrmLabel = ($: typeof enCrm) => string;

const STATUS_VARIANT: Record<CrmCustomerStatus, StatusVariant> = {
  prospect: 'pending',
  active: 'active',
  inactive: 'inactive',
  blocked: 'inactive',
  archived: 'archived',
};

/**
 * Tabs the CRM API cannot answer today, with the contract each would need.
 * Recorded here rather than in a document so the requirement sits beside the
 * code that will consume it.
 */
const BACKEND_REQUIRED: { key: string; label: CrmLabel; detail: CrmLabel }[] = [
  {
    key: 'orders',
    label: ($) => $.drawer.tabs.orders,
    detail: ($) => $.backendRequired.orders,
  },
  {
    key: 'loyalty',
    label: ($) => $.drawer.tabs.loyalty,
    detail: ($) => $.backendRequired.loyalty,
  },
  {
    key: 'permissions',
    label: ($) => $.drawer.tabs.permissions,
    detail: ($) => $.backendRequired.permissions,
  },
];

type Props = {
  customerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (profile: CrmCustomerProfile) => void;
};

// ── Small presentational pieces (module scope: never redeclared per render) ───

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{message}</p>;
}

function EntryList({ entries, empty }: { entries: CrmTimelineEntry[]; empty: string }) {
  if (entries.length === 0) return <Empty message={empty} />;

  return (
    <ol className="flex flex-col gap-3">
      {entries.map((e, i) => (
        // Timeline entries carry no id of their own, so identity is composed
        // from what makes an entry unique: when it happened, and what it was.
        <li key={`${e.occurred_at}-${e.source}-${e.type}-${i}`} className="border-s-2 ps-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{e.title}</span>
            <Badge variant="outline" className="text-[10px]">
              {e.type}
            </Badge>
          </div>
          {e.body && <p className="mt-0.5 text-xs text-muted-foreground">{e.body}</p>}
          <time className="text-[11px] text-muted-foreground">
            {new Date(e.occurred_at).toLocaleString()}
          </time>
        </li>
      ))}
    </ol>
  );
}

export function CrmCustomerDrawer({ customerId, open, onOpenChange, onEdit }: Props) {
  const { t } = useTranslation('crm');
  const { can } = usePermission();
  const [tab, setTab] = useState('overview');

  const { data: profile, isLoading } = useCrmCustomerProfileQuery(open ? customerId : null);
  const { data: timeline, isLoading: timelineLoading } = useCrmCustomerTimelineQuery(
    customerId,
    open && tab === 'timeline',
  );
  const { data: activity, isLoading: activityLoading } = useCrmCustomerActivitiesQuery(
    customerId,
    open && tab === 'activity',
  );
  const { data: intelligence, isLoading: intelligenceLoading } = useCrmCustomerIntelligenceQuery(
    customerId,
    open && tab === 'analytics',
  );

  const identity = profile?.identity;

  const tabs: TabItem[] = [
    {
      key: 'overview',
      label: t(($) => $.drawer.tabs.overview),
      content: profile ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t(($) => $.drawer.overview.code)} value={identity?.code ?? '—'} />
            <Field
              label={t(($) => $.drawer.overview.status)}
              value={
                identity?.status ? (
                  <StatusBadge status={STATUS_VARIANT[identity.status]} />
                ) : (
                  '—'
                )
              }
            />
            <Field
              label={t(($) => $.drawer.overview.group)}
              value={profile.group?.name ?? t(($) => $.drawer.overview.noGroup)}
            />
            <Field
              label={t(($) => $.drawer.overview.language)}
              value={identity?.preferred_language ?? '—'}
            />
          </div>

          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              {t(($) => $.drawer.overview.tags)}
            </p>
            {profile.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {profile.tags.map((tag) => (
                  <Badge key={tag.id} variant="outline">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t(($) => $.drawer.overview.noTags)}</p>
            )}
          </div>
        </div>
      ) : null,
    },
    {
      key: 'contact',
      label: t(($) => $.drawer.tabs.contact),
      badge: profile ? profile.phones.length + profile.emails.length : undefined,
      content: profile ? (
        <div className="flex flex-col gap-5">
          <section>
            <h3 className="mb-2 text-sm font-semibold">{t(($) => $.drawer.contact.phones)}</h3>
            {profile.phones.length === 0 ? (
              <Empty message={t(($) => $.drawer.contact.noPhones)} />
            ) : (
              <ul className="flex flex-col gap-1.5">
                {profile.phones.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span>{p.phone}</span>
                    {p.label && <span className="text-muted-foreground">{p.label}</span>}
                    {p.is_primary && (
                      <Badge variant="secondary" className="text-[10px]">
                        {t(($) => $.drawer.contact.primary)}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">{t(($) => $.drawer.contact.emails)}</h3>
            {profile.emails.length === 0 ? (
              <Empty message={t(($) => $.drawer.contact.noEmails)} />
            ) : (
              <ul className="flex flex-col gap-1.5">
                {profile.emails.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="break-all">{e.email}</span>
                    {e.is_primary && (
                      <Badge variant="secondary" className="text-[10px]">
                        {t(($) => $.drawer.contact.primary)}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null,
    },
    {
      key: 'addresses',
      label: t(($) => $.drawer.tabs.addresses),
      badge: profile?.addresses.length,
      content: profile ? (
        profile.addresses.length === 0 ? (
          <Empty message={t(($) => $.drawer.addresses.none)} />
        ) : (
          <ul className="flex flex-col gap-3">
            {profile.addresses.map((a) => (
              <li key={a.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{a.label ?? '—'}</span>
                  {a.is_default && (
                    <Badge variant="secondary" className="text-[10px]">
                      {t(($) => $.drawer.addresses.default)}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-muted-foreground">
                  {[a.address_line, a.area, a.city, a.governorate].filter(Boolean).join(t(($) => $.drawer.addresses.separator))}
                </p>
              </li>
            ))}
          </ul>
        )
      ) : null,
    },
    {
      key: 'notes',
      label: t(($) => $.drawer.tabs.notes),
      badge: profile?.notes.length,
      content: profile ? (
        profile.notes.length === 0 ? (
          <Empty message={t(($) => $.drawer.notes.none)} />
        ) : (
          <ul className="flex flex-col gap-2">
            {profile.notes.map((n) => (
              <li key={n.id} className="rounded-md border p-3">
                {n.is_pinned && (
                  <Badge variant="secondary" className="mb-1 text-[10px]">
                    {t(($) => $.drawer.notes.pinned)}
                  </Badge>
                )}
                <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                {n.created_at && (
                  <time className="text-[11px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </time>
                )}
              </li>
            ))}
          </ul>
        )
      ) : null,
    },
    {
      key: 'documents',
      label: t(($) => $.drawer.tabs.documents),
      badge: profile?.documents.length,
      content: profile ? (
        profile.documents.length === 0 ? (
          <Empty message={t(($) => $.drawer.documents.none)} />
        ) : (
          <ul className="flex flex-col gap-2">
            {profile.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-md border p-3">
                <span className="truncate text-sm">{d.name}</span>
                <span className="ms-3 shrink-0 text-xs text-muted-foreground">
                  {d.size_bytes
                    ? t(($) => $.drawer.documents.size, { size: Math.ceil(d.size_bytes / 1024) })
                    : (d.doc_type ?? '')}
                </span>
              </li>
            ))}
          </ul>
        )
      ) : null,
    },
    {
      key: 'timeline',
      label: t(($) => $.drawer.tabs.timeline),
      content: timelineLoading ? (
        <Empty message={t(($) => $.drawer.timeline.loading)} />
      ) : (
        <EntryList entries={timeline ?? []} empty={t(($) => $.drawer.timeline.none)} />
      ),
    },
    {
      key: 'activity',
      label: t(($) => $.drawer.tabs.activity),
      content: activityLoading ? (
        <Empty message={t(($) => $.drawer.activity.loading)} />
      ) : (
        <EntryList entries={activity ?? []} empty={t(($) => $.drawer.activity.none)} />
      ),
    },
    {
      key: 'analytics',
      label: t(($) => $.analytics.tab),
      content: <CrmCustomerAnalyticsTab data={intelligence} isLoading={intelligenceLoading} />,
    },
    // Named, with the exact contract each needs. A disabled tab that says what
    // is missing is honest; an empty one implies the data exists and failed to
    // load.
    ...BACKEND_REQUIRED.map((item) => ({
      key: item.key,
      label: t(item.label),
      disabled: true,
      content: (
        <div className="flex flex-col gap-2 py-6">
          <Badge variant="outline" className="w-fit">
            {t(($) => $.backendRequired.badge)}
          </Badge>
          <p className="text-sm text-muted-foreground">{t(item.detail)}</p>
        </div>
      ),
    })),
  ];

  return (
    <EntityDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={identity?.display_name ?? t(($) => $.drawer.detailsTitle)}
      description={identity?.code ?? undefined}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t(($) => $.drawer.close)}
          </Button>
          {/* Hidden without the permission rather than shown disabled. */}
          {profile && can('crm.customers.update') && (
            <Button onClick={() => onEdit(profile)}>{t(($) => $.drawer.edit)}</Button>
          )}
        </div>
      }
    >
      {isLoading ? (
        <Empty message={t(($) => $.drawer.timeline.loading)} />
      ) : (
        <Tabs tabs={tabs} activeKey={tab} onTabChange={setTab} />
      )}
    </EntityDrawer>
  );
}
