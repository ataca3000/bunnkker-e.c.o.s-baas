/**
 * The authenticated user's notification feed — GET /api/notifications.
 *
 * The wire shape is Laravel's `notifications` table, passed through: `type` is
 * the producing notification's FQCN and `data` is whatever that class's
 * `toDatabase()` returned. Producers own their payloads, so `data` is read
 * defensively here rather than typed as a fixed contract that would break the
 * first time a producer adds a field.
 */
export type RawNotification = {
  id: string;
  /** The producing notification class's FQCN. The only stable discriminator. */
  type: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string | null;
};

export type NotificationPage = {
  data: RawNotification[];
  unread_count: number;
  meta: { page: number; perPage: number; total: number; lastPage: number };
};

/**
 * The module a notification came from, derived from its FQCN.
 *
 * This is a grouping of what producers exist today, not a taxonomy anyone has
 * to maintain: an unrecognised namespace falls to `other` and still shows,
 * rather than being dropped because no category claimed it.
 */
export const NOTIFICATION_SOURCES = [
  'operations',
  'logistics',
  'marketing',
  'pos',
  'system',
  'other',
] as const;

export type NotificationSource = (typeof NOTIFICATION_SOURCES)[number];

/** Producer-declared severity. Anything else is treated as `info`. */
export const NOTIFICATION_SEVERITIES = ['info', 'success', 'warning', 'error'] as const;

export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number];

/** What the notification centre actually renders. */
export type UiNotification = {
  id: string;
  source: NotificationSource;
  severity: NotificationSeverity;
  /** The producer's own message. Empty when the producer supplied none. */
  message: string;
  createdAt: string | null;
  read: boolean;
};

const SOURCE_BY_SEGMENT: Record<string, NotificationSource> = {
  Operations: 'operations',
  Logistics: 'logistics',
  Marketing: 'marketing',
  POS: 'pos',
  System: 'system',
};

function sourceOf(type: string): NotificationSource {
  // FQCNs look like `Modules\Operations\Preparation\...\WaveCompletedNotification`.
  const segment = type.split('\\')[1] ?? '';
  return SOURCE_BY_SEGMENT[segment] ?? 'other';
}

function severityOf(data: Record<string, unknown>): NotificationSeverity {
  const raw = data.severity;
  return NOTIFICATION_SEVERITIES.includes(raw as NotificationSeverity)
    ? (raw as NotificationSeverity)
    : 'info';
}

/**
 * Normalises one wire notification for display.
 *
 * `message` is the producer's own text and is shown verbatim. It is not
 * translated, because it is data the backend composed — inventing a key for it
 * here would mean guessing at strings the producer may change tomorrow.
 */
export function toUiNotification(raw: RawNotification): UiNotification {
  const message = typeof raw.data.message === 'string' ? raw.data.message : '';

  return {
    id: raw.id,
    source: sourceOf(raw.type),
    severity: severityOf(raw.data),
    message,
    createdAt: raw.created_at,
    read: raw.read_at !== null,
  };
}
