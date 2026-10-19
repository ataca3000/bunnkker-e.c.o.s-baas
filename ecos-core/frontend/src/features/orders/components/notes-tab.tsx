import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Loader2, MessageSquare, Pencil, Search, Trash2, TriangleAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ds/use-toast';
import {
  useAddOrderNote,
  useDeleteOrderNote,
  useUpdateOrderNote,
} from '@/features/orders/hooks/use-orders';
import type { Order, OrderNote } from '@/features/orders/types/order';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  const time = d.toLocaleString('en-EG', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (isToday) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  return d.toLocaleString('en-EG', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-EG', { month: 'short', day: 'numeric', year: 'numeric' });
}

function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

const SECTION_HEADING =
  'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2';

// ─── Filter types ─────────────────────────────────────────────────────────────

type NoteFilter = 'all' | 'internal' | 'customer' | 'woocommerce';

// ─── Avatar ───────────────────────────────────────────────────────────────────

function UserAvatar({ name, size = 'sm' }: { name: string | null; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'size-7 text-[10px]' : 'size-8 text-xs';
  return (
    <div
      className={`${sz} rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center shrink-0 select-none`}
    >
      {initials(name)}
    </div>
  );
}

// ─── Internal Note Card ───────────────────────────────────────────────────────

function InternalNoteCard({
  note,
  orderId,
}: {
  note: OrderNote;
  orderId: string;
}) {
  const { t } = useTranslation('orders');
  const [editing, setEditing]   = useState(false);
  const [editText, setEditText] = useState(note.content);
  const { toast }               = useToast();
  const updateNote              = useUpdateOrderNote();
  const deleteNote              = useDeleteOrderNote();

  function handleSaveEdit() {
    if (!editText.trim() || editText === note.content) {
      setEditing(false);
      return;
    }
    updateNote.mutate(
      { orderId, noteId: note.id, content: editText.trim() },
      {
        onSuccess: () => {
          setEditing(false);
          toast({ title: t($ => $.notesTab.noteUpdated) });
        },
        onError: () => toast({ title: t($ => $.notesTab.noteUpdateFailed), variant: 'destructive' }),
      },
    );
  }

  function handleDelete() {
    deleteNote.mutate(
      { orderId, noteId: note.id },
      {
        onSuccess: () => toast({ title: t($ => $.notesTab.noteDeleted) }),
        onError:   () => toast({ title: t($ => $.notesTab.noteDeleteFailed), variant: 'destructive' }),
      },
    );
  }

  return (
    <div className="flex gap-3 group">
      <UserAvatar name={note.user_name} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
          <span className="text-xs font-semibold">{note.user_name ?? t($ => $.notesTab.unknown)}</span>
          {note.user_role && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 leading-none text-muted-foreground">
              {note.user_role}
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground">{fmtDateTime(note.created_at)}</span>
        </div>

        {editing ? (
          <div className="flex flex-col gap-2 mt-1">
            <textarea
              rows={3}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveEdit();
                if (e.key === 'Escape') { setEditing(false); setEditText(note.content); }
              }}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={handleSaveEdit} disabled={updateNote.isPending}>
                {updateNote.isPending ? <Loader2 className="size-3 animate-spin" /> : t($ => $.notesTab.save)}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditing(false); setEditText(note.content); }}>
                {t($ => $.notesTab.cancel)}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{note.content}</p>
        )}

        {note.is_edited && !editing && (
          <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
            <Pencil className="size-3" />
            {t($ => $.notesTab.updatedBy, { name: note.edited_by_name ?? '' })}
            {note.edited_at ? ` · ${fmtDateTime(note.edited_at)}` : ''}
          </p>
        )}
      </div>

      {!editing && (
        <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-0.5">
          <Button
            size="icon"
            variant="ghost"
            className="size-6"
            onClick={() => setEditing(true)}
            aria-label={t($ => $.notesTab.editNote)}
          >
            <Pencil className="size-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-6 text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={deleteNote.isPending}
            aria-label={t($ => $.notesTab.deleteNote)}
          >
            {deleteNote.isPending ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Compose Box ─────────────────────────────────────────────────────────────

function ComposeBox({ orderId }: { orderId: string }) {
  const { t } = useTranslation('orders');
  const [text, setText]   = useState('');
  const { toast }         = useToast();
  const addNote           = useAddOrderNote();
  const ref               = useRef<HTMLTextAreaElement>(null);

  function handleSubmit() {
    if (!text.trim()) return;
    addNote.mutate(
      { id: orderId, content: text.trim(), type: 'internal' },
      {
        onSuccess: () => {
          setText('');
          toast({ title: t($ => $.notesTab.noteAdded) });
        },
        onError: () => toast({ title: t($ => $.notesTab.noteAddFailed), variant: 'destructive' }),
      },
    );
  }

  // Auto-resize textarea
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  return (
    <div className="rounded-lg border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
      <textarea
        ref={ref}
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t($ => $.notesTab.writePlaceholder)}
        className="w-full px-3 pt-3 pb-1 text-sm resize-none bg-transparent focus:outline-none min-h-[64px]"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
        }}
      />
      <div className="flex items-center justify-between px-3 pb-2">
        <span className="text-[10px] text-muted-foreground">{t($ => $.notesTab.ctrlEnterHint)}</span>
        <Button
          size="sm"
          className="h-7 text-xs gap-1"
          disabled={!text.trim() || addNote.isPending}
          onClick={handleSubmit}
        >
          {addNote.isPending ? <Loader2 className="size-3 animate-spin" /> : t($ => $.notesTab.addNote)}
        </Button>
      </div>
    </div>
  );
}

// ─── Customer Note Section ────────────────────────────────────────────────────

function CustomerNotesSection({ order }: { order: Order }) {
  const { t } = useTranslation('orders');
  const customerNotes = order.order_notes_list.filter((n) => n.type === 'customer');
  const hasLegacy     = Boolean(order.notes);

  if (!hasLegacy && customerNotes.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        <Clock className="size-4 mr-2 opacity-40" />
        {t($ => $.notesTab.noCustomerNotes)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Legacy order.notes shown as original note */}
      {hasLegacy && (
        <div className="rounded-lg border bg-muted/30 p-3.5 flex flex-col gap-1.5">
          <p className="text-sm whitespace-pre-wrap break-words">{order.notes}</p>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span>{t($ => $.notesTab.added)}</span>
            {order.created_at && <span>{fmtDate(order.created_at)}</span>}
            {order.created_by_name && (
              <>
                <span>·</span>
                <span>{t($ => $.notesTab.by)} {order.created_by_name}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Structured customer notes from table */}
      {customerNotes.map((n) => (
        <div key={n.id} className="rounded-lg border bg-muted/30 p-3.5 flex flex-col gap-1.5">
          <p className="text-sm whitespace-pre-wrap break-words">{n.content}</p>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span>{t($ => $.notesTab.added)} {fmtDateTime(n.created_at)}</span>
            {n.user_name && <><span>·</span><span>{t($ => $.notesTab.by)} {n.user_name}</span></>}
          </div>
          {n.is_edited && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Pencil className="size-2.5" />
              {t($ => $.notesTab.updatedBy, { name: n.edited_by_name ?? '' })}
              {n.edited_at ? ` · ${fmtDateTime(n.edited_at)}` : ''}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Internal Notes Section ───────────────────────────────────────────────────

function InternalNotesSection({ order }: { order: Order }) {
  const { t } = useTranslation('orders');
  const notes = order.order_notes_list.filter((n) => n.type === 'internal');

  return (
    <div className="flex flex-col gap-3">
      {notes.length === 0 ? (
        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
          <MessageSquare className="size-4 mr-2 opacity-40" />
          {t($ => $.notesTab.noInternalNotes)}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {notes.map((n) => (
            <InternalNoteCard key={n.id} note={n} orderId={order.id} />
          ))}
        </div>
      )}
      <Separator />
      <ComposeBox orderId={order.id} />
    </div>
  );
}

// ─── WooCommerce Notes Section ────────────────────────────────────────────────

function WooCommerceNotesSection({ order }: { order: Order }) {
  const { t } = useTranslation('orders');

  if (!order.customer_note) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        <Clock className="size-4 mr-2 opacity-40" />
        {t($ => $.notesTab.noWooNote)}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/10 p-3.5 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide">
        <TriangleAlert className="size-3" />
        {t($ => $.notesTab.customerLeftNote)}
      </div>
      <p className="text-sm whitespace-pre-wrap break-words">{order.customer_note}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type OrderNotesTabProps = {
  order: Order;
};

export function OrderNotesTab({ order }: OrderNotesTabProps) {
  const { t } = useTranslation('orders');
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState<NoteFilter>('all');

  const filterLabels: Record<NoteFilter, string> = {
    all:         t($ => $.notesTab.filterAll),
    internal:    t($ => $.notesTab.filterInternal),
    customer:    t($ => $.notesTab.filterCustomer),
    woocommerce: t($ => $.notesTab.filterWooCommerce),
  };

  const hasWooNote   = Boolean(order.customer_note);
  const hasCustomer  = Boolean(order.notes) || order.order_notes_list.some((n) => n.type === 'customer');

  // Determine which sections to show based on filter
  const showCustomer    = filter === 'all' || filter === 'customer';
  const showInternal    = filter === 'all' || filter === 'internal';
  const showWooCommerce = (filter === 'all' || filter === 'woocommerce') && hasWooNote;

  // Filter notes by search within internal section
  const filteredOrder: Order = search.trim()
    ? {
        ...order,
        order_notes_list: order.order_notes_list.filter((n) =>
          n.content.toLowerCase().includes(search.toLowerCase()) ||
          (n.user_name ?? '').toLowerCase().includes(search.toLowerCase()),
        ),
        notes: (order.notes ?? '').toLowerCase().includes(search.toLowerCase())
          ? order.notes
          : null,
        customer_note: (order.customer_note ?? '').toLowerCase().includes(search.toLowerCase())
          ? order.customer_note
          : null,
      }
    : order;

  const totalCount =
    (filteredOrder.order_notes_list.length) +
    (filteredOrder.notes ? 1 : 0) +
    (filteredOrder.customer_note ? 1 : 0);

  return (
    <div className="flex flex-col h-full">
      {/* Search + Filter bar */}
      <div className="flex flex-col gap-2 px-4 pt-4 pb-3 border-b shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t($ => $.notesTab.searchPlaceholder)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-1">
          {(Object.entries(filterLabels) as [NoteFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                filter === key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {label}
              {key === 'woocommerce' && hasWooNote && (
                <span className="ml-1 size-1.5 rounded-full bg-amber-500 inline-block" />
              )}
            </button>
          ))}
          {search && (
            <span className="ms-auto text-[10px] text-muted-foreground">
              {t($ => $.notesTab.results, { count: totalCount })}
            </span>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">

        {showCustomer && (
          <section>
            <p className={SECTION_HEADING}>{t($ => $.notesTab.customerNotes)}</p>
            <CustomerNotesSection order={filteredOrder} />
          </section>
        )}

        {showCustomer && showInternal && (showCustomer && hasCustomer) && <Separator />}

        {showInternal && (
          <section>
            <p className={SECTION_HEADING}>{t($ => $.notesTab.internalNotes)}</p>
            <InternalNotesSection order={filteredOrder} />
          </section>
        )}

        {showWooCommerce && (
          <>
            {showInternal && <Separator />}
            <section>
              <p className={SECTION_HEADING}>{t($ => $.notesTab.wooCommerceNotes)}</p>
              <WooCommerceNotesSection order={filteredOrder} />
            </section>
          </>
        )}

      </div>
    </div>
  );
}
