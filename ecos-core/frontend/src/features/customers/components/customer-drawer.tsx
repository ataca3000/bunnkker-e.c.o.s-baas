import {
  Calendar,
  Copy,
  FileText,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  ShoppingBag,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/crud/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs } from '@/components/ds/tabs';
import { OrderStatusBadge } from '@/features/orders/components/order-status-badge';
import { useOrdersQuery, useCustomerOrderStats } from '@/features/orders/hooks/use-orders';
import type { Customer } from '@/features/customers/types/customer';
;

type Props = {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (customer: Customer) => void;
  defaultTab?: string;
};

// ── Shared phone row ──────────────────────────────────────────────────────────

function PhoneRow({
  phone,
  label,
}: {
  phone: string;
  label: string;
}) {
  const { t } = useTranslation('customers');
  const [copied, setCopied] = useState(false);
  const bare = phone.replace(/\D/g, '');

  const doCopy = () => {
    void navigator.clipboard.writeText(phone).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 font-mono text-sm">{phone}</span>
      <Badge variant="secondary" className="h-4 shrink-0 px-1.5 text-[9px]">
        {label}
      </Badge>
      <Button size="icon" variant="ghost" className="size-7" asChild title={t($ => $.phone.call)}>
        <a href={`tel:${bare}`}>
          <Phone className="size-3.5" />
        </a>
      </Button>
      <Button size="icon" variant="ghost" className="size-7" asChild title={t($ => $.phone.whatsapp)}>
        <a href={`https://wa.me/${bare}`} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="size-3.5" />
        </a>
      </Button>
      <Button size="icon" variant="ghost" className="size-7" onClick={doCopy} title={t($ => $.phone.copy)}>
        {copied ? (
          <span className="text-[9px] text-emerald-600">✓</span>
        ) : (
          <Copy className="size-3.5" />
        )}
      </Button>
    </div>
  );
}

// ── Summary tab ───────────────────────────────────────────────────────────────

function SummaryTab({ customer }: { customer: Customer }) {
  const { t } = useTranslation('customers');
  const { data: stats, isLoading } = useCustomerOrderStats(customer.id);

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Identity */}
      <div className="flex items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
          {customer.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{customer.name}</p>
          <p className="text-xs text-muted-foreground">{customer.code}</p>
        </div>
        <StatusBadge status={customer.is_active ? 'active' : 'inactive'} className="ms-auto shrink-0" />
      </div>

      {/* Order stats */}
      <div className="grid grid-cols-3 gap-2 rounded-lg border p-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <Skeleton className="h-5 w-10" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))
        ) : (
          <>
            <div className="flex flex-col items-center gap-0.5 text-center">
              <span className="text-lg font-semibold tabular-nums">{stats?.total ?? '—'}</span>
              <span className="text-[11px] text-muted-foreground">{t($ => $.drawer.summary.totalOrders)}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 border-x text-center">
              <span className="text-base font-semibold tabular-nums">
                {stats?.lastOrderDate
                  ? new Date(stats.lastOrderDate).toLocaleDateString()
                  : '—'}
              </span>
              <span className="text-[11px] text-muted-foreground">{t($ => $.drawer.summary.lastOrder)}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 text-center">
              <span className="text-base font-semibold tabular-nums">
                {stats?.totalSpend != null
                  ? stats.totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })
                  : '—'}
              </span>
              <span className="text-[11px] text-muted-foreground">{t($ => $.drawer.summary.totalSpend)}</span>
            </div>
          </>
        )}
      </div>

      {/* Info rows */}
      <div className="flex flex-col gap-2.5 rounded-lg border p-3 text-sm">
        {customer.code ? (
          <InfoRow label={t($ => $.drawer.summary.code)} value={customer.code} />
        ) : null}
        {customer.contact_person ? (
          <InfoRow label={t($ => $.drawer.summary.contactPerson)} value={customer.contact_person} />
        ) : null}
        {customer.email ? (
          <InfoRow label={t($ => $.drawer.summary.email)} value={customer.email} />
        ) : null}
        {customer.created_at ? (
          <InfoRow
            label={t($ => $.drawer.summary.memberSince)}
            value={new Date(customer.created_at).toLocaleDateString()}
          />
        ) : null}
        {customer.updated_at ? (
          <InfoRow
            label={t($ => $.drawer.summary.lastUpdated)}
            value={new Date(customer.updated_at).toLocaleDateString()}
          />
        ) : null}
      </div>

      {/* Brands */}
      {customer.brands && customer.brands.length > 0 ? (
        <div className="flex flex-col gap-1.5 rounded-lg border p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t($ => $.drawer.summary.brands, { defaultValue: 'Brands' })}
          </p>
          <div className="flex flex-col gap-1.5">
            {customer.brands.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-2.5 py-1.5"
              >
                <span className="flex min-w-0 items-center gap-1.5 truncate text-xs font-medium">
                  {b.is_primary && <span className="text-primary">★</span>}
                  <span className="truncate">{b.brand_name ?? b.brand_code ?? '—'}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3 text-[11px] text-muted-foreground">
                  <span>{b.orders_count} {t($ => $.drawer.summary.brandOrders, { defaultValue: 'orders' })}</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {Number(b.lifetime_value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                  {b.last_order_at && (
                    <span className="hidden sm:inline">
                      {new Date(b.last_order_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Phones tab ────────────────────────────────────────────────────────────────

function PhonesTab({ customer }: { customer: Customer }) {
  const { t } = useTranslation('customers');
  const hasAny = customer.phone || customer.mobile;

  return (
    <div className="p-4">
      {hasAny ? (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t($ => $.drawer.phonesTab.title)}
          </p>
          {customer.phone ? (
            <PhoneRow phone={customer.phone} label={t($ => $.drawer.phonesTab.primary)} />
          ) : null}
          {customer.mobile ? (
            <PhoneRow phone={customer.mobile} label={t($ => $.drawer.phonesTab.secondary)} />
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Phone className="size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t($ => $.drawer.phonesTab.noPhone)}</p>
        </div>
      )}
    </div>
  );
}

// ── Addresses tab ─────────────────────────────────────────────────────────────

function AddressesTab({ customer }: { customer: Customer }) {
  const { t } = useTranslation('customers');
  const [copied, setCopied] = useState(false);

  const addressLine  = customer.address;
  const localityLine = [customer.city, customer.country].filter(Boolean).join(', ');
  const fullAddress  = [addressLine, localityLine].filter(Boolean).join(' — ');

  const doCopy = () => {
    if (!fullAddress) return;
    void navigator.clipboard.writeText(fullAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="p-4">
      {fullAddress ? (
        <div className="flex flex-col gap-3 rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              {t($ => $.drawer.addresses.default)}
            </Badge>
          </div>

          {addressLine ? (
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <p className="text-sm">{addressLine}</p>
            </div>
          ) : null}
          {localityLine ? (
            <p className="ms-5 text-xs text-muted-foreground">{localityLine}</p>
          ) : null}

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs"
              onClick={doCopy}
            >
              <Copy className="size-3" />
              {copied ? '✓' : t($ => $.drawer.addresses.copyAddress)}
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" asChild>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MapPin className="size-3" />
                {t($ => $.drawer.addresses.openMap)}
              </a>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <MapPin className="size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t($ => $.drawer.addresses.noAddress)}</p>
        </div>
      )}
    </div>
  );
}

// ── Orders tab ────────────────────────────────────────────────────────────────

function OrdersTab({ customer }: { customer: Customer }) {
  const { t } = useTranslation('customers');
  const { data, isLoading } = useOrdersQuery({
    customer_id: customer.id,
    per_page: 15,
    sort_by: 'order_date',
    sort_dir: 'desc',
  });

  const orders = data?.items ?? [];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <ShoppingBag className="size-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t($ => $.drawer.orders.empty)}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      {orders.map((order) => (
        <div
          key={order.id}
          className="flex items-center justify-between rounded-lg border px-3 py-2.5"
        >
          <div className="flex flex-col gap-0.5">
            <p className="font-mono text-sm font-medium">{order.order_number}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="size-3" />
              {order.order_date ? new Date(order.order_date).toLocaleDateString() : '—'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <span className="text-sm font-medium tabular-nums">
              {order.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      ))}
      {data && data.meta.total > 15 ? (
        <p className="text-center text-xs text-muted-foreground">
          {t($ => $.drawer.orders.more, { count: data.meta.total - 15 })}
        </p>
      ) : null}
    </div>
  );
}

// ── Memory tab (Customer Notes / Pinned Notes) ────────────────────────────────

function MemoryTab({
  customer,
  onEdit,
  onOpenChange,
}: {
  customer: Customer;
  onEdit: (customer: Customer) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('customers');

  return (
    <div className="p-4">
      {customer.notes ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2 rounded-lg border bg-amber-50/50 p-3 dark:bg-amber-950/20">
            <FileText className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t($ => $.drawer.memory.note)}
              </p>
              <p className="whitespace-pre-wrap text-sm">{customer.notes}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 w-fit gap-1.5 text-xs"
            onClick={() => {
              onOpenChange(false);
              onEdit(customer);
            }}
          >
            <Pencil className="size-3" />
            {t($ => $.drawer.memory.edit)}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <FileText className="size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t($ => $.drawer.memory.empty)}</p>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={() => {
              onOpenChange(false);
              onEdit(customer);
            }}
          >
            <Pencil className="size-3" />
            {t($ => $.drawer.memory.edit)}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Helper ────────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-28 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CustomerDrawer({ customer, open, onOpenChange, onEdit, defaultTab }: Props) {
  const { t } = useTranslation('customers');

  const [activeTab, setActiveTab] = useState(defaultTab ?? 'summary');

  useEffect(() => {
    setActiveTab(defaultTab ?? 'summary');
  }, [customer?.id, defaultTab]);

  // Must call all hooks before any conditional return
  // (useCustomerOrderStats is called inside SummaryTab which is only rendered when active)

  if (!customer) return null;

  const primaryPhone = customer.phone;
  const addressLine  = [customer.city, customer.country].filter(Boolean).join(', ');

  const tabs = [
    {
      key: 'summary',
      label: t($ => $.drawer.tabs.summary),
      content: <SummaryTab customer={customer} />,
    },
    {
      key: 'phones',
      label: t($ => $.drawer.tabs.phones),
      content: <PhonesTab customer={customer} />,
    },
    {
      key: 'addresses',
      label: t($ => $.drawer.tabs.addresses),
      content: <AddressesTab customer={customer} />,
    },
    {
      key: 'orders',
      label: t($ => $.drawer.tabs.orders),
      content: <OrdersTab customer={customer} />,
    },
    {
      key: 'memory',
      label: t($ => $.drawer.tabs.memory),
      content: (
        <MemoryTab customer={customer} onEdit={onEdit} onOpenChange={onOpenChange} />
      ),
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <SheetHeader className="border-b px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-base font-semibold leading-tight">
                {customer.name}
              </SheetTitle>

              {/* Phone quick actions */}
              {primaryPhone ? (
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="font-mono text-xs text-muted-foreground">{primaryPhone}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-5"
                    asChild
                    title={t($ => $.phone.call)}
                  >
                    <a href={`tel:${primaryPhone.replace(/\D/g, '')}`}>
                      <Phone className="size-3" />
                    </a>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-5"
                    asChild
                    title={t($ => $.phone.whatsapp)}
                  >
                    <a
                      href={`https://wa.me/${primaryPhone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="size-3" />
                    </a>
                  </Button>
                </div>
              ) : null}

              {/* Address line */}
              {addressLine ? (
                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" />
                  <span>{addressLine}</span>
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(customer);
                }}
              >
                <Pencil className="size-3" />
                {t($ => $.actions.edit)}
              </Button>
              <SheetClose asChild>
                <Button variant="ghost" size="icon" className="size-7">
                  <X className="size-4" />
                </Button>
              </SheetClose>
            </div>
          </div>
        </SheetHeader>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <Tabs
          tabs={tabs}
          activeKey={activeTab}
          onTabChange={setActiveTab}
          className="flex-1 overflow-hidden"
          contentClassName="overflow-y-auto"
        />
      </SheetContent>
    </Sheet>
  );
}
