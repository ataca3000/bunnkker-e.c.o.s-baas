import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ErrorState, LoadingState, PageHeader } from '@/components/crud';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useApplicantTimelineQuery,
  useTagCatalogueQuery,
  useTagSearchQuery,
} from '@/features/hr/hooks/use-hr-enhancements';
import type { AssignedTag, TimelineEvent } from '@/features/hr/types/recruitment-enhancements';

/** Tag colours, mapped once so the same tag looks the same everywhere. */
const TAG_CLASS: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  red: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  violet: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  sky: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  teal: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200',
  slate: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
};

/**
 * Applicant tags and the candidate timeline.
 *
 * Tags are a catalogue rather than free text, which is what makes "show me every
 * VIP candidate" a query instead of a guess.
 */
export function ApplicantTagsPage() {
  const { t } = useTranslation('hr');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [matchAll, setMatchAll] = useState(false);
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | undefined>(undefined);

  const { data: catalogue, isLoading, isError, refetch } = useTagCatalogueQuery();
  const { data: search } = useTagSearchQuery(selectedKeys, matchAll);
  const { data: timeline } = useApplicantTimelineQuery(selectedApplicantId);

  if (isLoading) return <LoadingState />;
  if (isError || !catalogue) return <ErrorState onRetry={() => void refetch()} />;

  const toggle = (key: string) =>
    setSelectedKeys((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t($ => $.tags.title)}
        subtitle={t($ => $.tags.subtitle)}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t($ => $.tags.catalogue)}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {catalogue.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggle(tag.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  TAG_CLASS[tag.color] ?? TAG_CLASS.slate
                } ${selectedKeys.includes(tag.key) ? 'ring-primary ring-2' : ''} ${
                  tag.is_active ? '' : 'opacity-50'
                }`}
                title={tag.description ?? undefined}
              >
                {tag.name}
                <span className="ms-1.5 opacity-70">{tag.applicant_count}</span>
              </button>
            ))}
          </div>

          {selectedKeys.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Button size="sm" variant={matchAll ? 'default' : 'outline'} onClick={() => setMatchAll((v) => !v)}>
                {matchAll ? t($ => $.tags.matchAll) : t($ => $.tags.matchAny)}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedKeys([])}>
                {t($ => $.common.clear)}
              </Button>
              <span className="text-muted-foreground">
                {t($ => $.tags.applicantCount, { count: search?.total ?? 0 })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t($ => $.tags.matchingApplicants)}</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedKeys.length === 0 && (
              <p className="text-muted-foreground text-sm">{t($ => $.tags.selectTagHint)}</p>
            )}
            {selectedKeys.length > 0 && (search?.items ?? []).length === 0 && (
              <p className="text-muted-foreground text-sm">
                {matchAll ? t($ => $.tags.emptyAll) : t($ => $.tags.emptyAny)}
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {(search?.items ?? []).map((applicant) => (
                <li key={applicant.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedApplicantId(applicant.id)}
                    className={`hover:bg-muted/50 w-full rounded-md border p-3 text-start ${
                      selectedApplicantId === applicant.id ? 'bg-muted/60' : ''
                    }`}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-medium">{applicant.full_name}</span>
                      <span className="text-muted-foreground font-mono text-xs">{applicant.applicant_number}</span>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {applicant.mobile ?? '—'} · {applicant.status}
                      {applicant.in_talent_pool ? ` · ${t($ => $.tags.talentPool)}` : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {applicant.tags.map((tag: AssignedTag) => (
                        <span
                          key={tag.id}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            TAG_CLASS[tag.color] ?? TAG_CLASS.slate
                          }`}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t($ => $.tags.timeline)}</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedApplicantId && (
              <p className="text-muted-foreground text-sm">{t($ => $.tags.pickApplicantHint)}</p>
            )}
            {selectedApplicantId && (timeline?.events ?? []).length === 0 && (
              <p className="text-muted-foreground text-sm">{t($ => $.tags.timelineEmpty)}</p>
            )}
            <ol className="flex flex-col gap-3">
              {(timeline?.events ?? []).map((event: TimelineEvent) => (
                <li key={event.id} className="border-s-2 ps-3">
                  <div className="flex flex-wrap items-baseline gap-2 text-sm">
                    <span className={event.is_milestone ? 'font-medium' : ''}>{event.title}</span>
                    <span className="text-muted-foreground text-[10px] uppercase">{event.category}</span>
                  </div>
                  {event.summary && <p className="text-muted-foreground text-sm">{event.summary}</p>}
                  <p className="text-muted-foreground text-xs">
                    {event.occurred_at}
                    {event.is_system ? ` · ${t($ => $.common.system)}` : event.actor_name ? ` · ${event.actor_name}` : ''}
                  </p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
