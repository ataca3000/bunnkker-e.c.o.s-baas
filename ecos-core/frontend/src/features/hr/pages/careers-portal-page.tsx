import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Briefcase, MapPin, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { usePublicJobsQuery } from '@/features/hr/hooks/use-recruitment';
import type { PublicJob } from '@/features/hr/types/recruitment';

const money = (value: number, currency: string) =>
  `${currency} ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

/**
 * The public careers portal.
 *
 * Rendered outside the application shell — a visitor has no session, no company
 * context and no navigation rail. It shows only what the company chose to
 * publish, because that is all the API will return.
 */
export function CareersPortalPage() {
  const { t } = useTranslation('hr');
  const [search, setSearch] = useState('');
  const [submitted, setSubmitted] = useState('');

  const { data: jobs, isLoading, isError } = usePublicJobsQuery(submitted ? { search: submitted } : {});

  const openings = jobs ?? [];

  return (
    <div className="bg-background min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-12">
          <span className="text-muted-foreground text-sm font-medium uppercase tracking-wide">
            {t($ => $.careers.portal.eyebrow)}
          </span>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t($ => $.careers.portal.heading)}</h1>
          <p className="text-muted-foreground max-w-2xl">{t($ => $.careers.portal.intro)}</p>

          <form
            className="flex max-w-md gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(search.trim());
            }}
          >
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t($ => $.careers.portal.searchPlaceholder)}
              aria-label={t($ => $.careers.portal.searchLabel)}
            />
            <Button type="submit" variant="outline">
              <Search className="size-4" />
              {t($ => $.common.search)}
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {isLoading ? (
          <p className="text-muted-foreground py-16 text-center text-sm">{t($ => $.careers.portal.loading)}</p>
        ) : isError ? (
          <p className="text-muted-foreground py-16 text-center text-sm">{t($ => $.careers.portal.loadError)}</p>
        ) : openings.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <Briefcase className="text-muted-foreground size-8" />
              <p className="font-medium">{t($ => $.careers.portal.emptyTitle)}</p>
              <p className="text-muted-foreground text-sm">
                {submitted ? t($ => $.careers.portal.emptySearch) : t($ => $.careers.portal.emptyHint)}
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-4">
            {openings.map((job: PublicJob) => (
              <li key={job.slug}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1.5">
                      <h2 className="text-lg font-semibold">{job.title}</h2>
                      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        {job.department ? <span>{job.department}</span> : null}
                        {job.employment_type ? <span>{job.employment_type}</span> : null}
                        {job.work_location ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3.5" />
                            {job.work_location}
                          </span>
                        ) : null}
                        <span className="capitalize">{job.work_mode}</span>
                        {job.openings > 1 ? <span>{t($ => $.careers.portal.openings, { count: job.openings })}</span> : null}
                      </div>
                      {/* Only shown when the company published the band. */}
                      {job.salary ? (
                        <span className="text-sm font-medium">
                          {job.salary.min !== null ? money(job.salary.min, job.salary.currency) : '—'}
                          {job.salary.max !== null ? ` – ${money(job.salary.max, job.salary.currency)}` : ''}
                        </span>
                      ) : null}
                    </div>

                    <Button asChild>
                      <Link to={`/careers/${job.slug}`}>{t($ => $.careers.portal.viewAndApply)}</Link>
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
