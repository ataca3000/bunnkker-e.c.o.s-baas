import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Eye, Plus, Users } from 'lucide-react';

import {
  ActionMenu,
  EntityDrawer,
  EntityTable,
  EntityToolbar,
  PageHeader,
  Pagination,
  StatusBadge,
} from '@/components/crud';
import type { ColumnDef, StatusVariant } from '@/components/crud/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDepartmentsQuery } from '@/features/hr/hooks/use-hr';
import {
  useApplicationsQuery,
  useBoardQuery,
  useCreateJobOpening,
  useJobOpeningsQuery,
  useStagesQuery,
  useTransitionJob,
  useUpcomingInterviewsQuery,
} from '@/features/hr/hooks/use-recruitment';
import type { Application, ApplicationStatusKey, JobStatus } from '@/features/hr/types/recruitment';

const PER_PAGE = 25;

const APPLICATION_TONE: Record<ApplicationStatusKey, StatusVariant> = {
  in_pipeline: 'pending',
  hold: 'pending',
  accepted: 'active',
  offer_sent: 'pending',
  offer_accepted: 'active',
  offer_declined: 'inactive',
  rejected: 'inactive',
  talent_pool: 'archived',
  withdrawn: 'archived',
};

const JOB_TONE: Record<JobStatus, StatusVariant> = {
  draft: 'inactive',
  published: 'active',
  on_hold: 'pending',
  closed: 'archived',
  filled: 'archived',
};

/**
 * The Applicant Tracking System.
 *
 * The pipeline board, the job openings behind it, and the searchable list of
 * everyone who applied.
 */
export function RecruitmentWorkspacePage() {
  const navigate = useNavigate();

  const [tab, setTab] = useState<'pipeline' | 'applications' | 'jobs'>('pipeline');
  const [jobFilter, setJobFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [jobDrawer, setJobDrawer] = useState(false);
  const [jobForm, setJobForm] = useState({ title: '', department_id: '', openings_count: '1', work_location: '' });
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(
    () => ({
      job_opening_id: jobFilter || undefined,
      stage_id: stageFilter || undefined,
      status: statusFilter || undefined,
      search: search || undefined,
      page,
      per_page: PER_PAGE,
    }),
    [jobFilter, stageFilter, statusFilter, search, page],
  );

  const { data: jobs } = useJobOpeningsQuery();
  const { data: stages } = useStagesQuery();
  const { data: board } = useBoardQuery(jobFilter ? { job_opening_id: jobFilter } : {});
  const { data: applications, isLoading, isError, isFetching, refetch } = useApplicationsQuery(params);
  const { data: interviews } = useUpcomingInterviewsQuery(14);
  const { data: departments } = useDepartmentsQuery();

  const createJob = useCreateJobOpening();
  const transition = useTransitionJob();

  const items = applications?.items ?? [];
  const meta = applications?.meta;
  const openJobs = (jobs ?? []).filter((j) => j.status === 'published').length;

  const submitJob = async () => {
    setError(null);

    if (!jobForm.title.trim()) {
      setError('A job title is required.');
      return;
    }

    try {
      await createJob.mutateAsync({
        title: jobForm.title,
        department_id: jobForm.department_id || undefined,
        openings_count: Number(jobForm.openings_count) || 1,
        work_location: jobForm.work_location || undefined,
      });
      setJobForm({ title: '', department_id: '', openings_count: '1', work_location: '' });
      setJobDrawer(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The job could not be created.');
    }
  };

  const columns: ColumnDef<Application>[] = [
    {
      key: 'application_number',
      header: 'Ref',
      cell: (a) => <span className="font-mono text-xs">{a.application_number}</span>,
    },
    { key: 'applicant_name', header: 'Applicant', cell: (a) => <span className="font-medium">{a.applicant_name ?? '—'}</span> },
    { key: 'job_title', header: 'Role', cell: (a) => <span className="text-muted-foreground">{a.job_title ?? '—'}</span> },
    { key: 'stage', header: 'Stage', cell: (a) => <span>{a.stage?.name ?? '—'}</span> },
    {
      key: 'years_experience',
      header: 'Exp.',
      cell: (a) => <span className="tabular-nums">{a.years_experience ?? '—'}</span>,
    },
    {
      key: 'match_score',
      header: 'Fit',
      cell: (a) => (
        <span className="tabular-nums" title="Screening aid — not a competence assessment">
          {a.match_score ?? '—'}
        </span>
      ),
    },
    { key: 'applied_at', header: 'Applied', cell: (a) => <span className="tabular-nums">{a.applied_at?.slice(0, 10) ?? '—'}</span> },
    {
      key: 'status',
      header: 'Status',
      cell: (a) => <StatusBadge status={APPLICATION_TONE[a.status]} label={a.status_label} />,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Recruitment"
        subtitle="Applications create an applicant — becoming an employee is a separate, deliberate step."
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <a href="/app/careers" target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                View Portal
              </a>
            </Button>
            <Button size="sm" onClick={() => setJobDrawer(true)}>
              <Plus className="size-4" />
              New Job
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Open Jobs</div>
            <div className="text-2xl font-bold">{openJobs}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Applications</div>
            <div className="text-2xl font-bold">{isLoading ? '—' : (meta?.total ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">In Pipeline</div>
            <div className="text-2xl font-bold text-amber-600">
              {(board ?? []).filter((c) => !c.is_terminal).reduce((s, c) => s + c.applications, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Interviews (14d)</div>
            <div className="text-2xl font-bold">{interviews?.items.length ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ['pipeline', 'Pipeline'],
          ['applications', 'Applications'],
          ['jobs', 'Job Openings'],
        ] as Array<[typeof tab, string]>).map(([key, label]) => (
          <Button key={key} size="sm" variant={tab === key ? 'default' : 'outline'} onClick={() => setTab(key)}>
            {label}
          </Button>
        ))}
      </div>

      {tab === 'pipeline' ? (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Pipeline</h2>
              <select
                value={jobFilter}
                onChange={(e) => setJobFilter(e.target.value)}
                className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
              >
                <option value="">All openings</option>
                {(jobs ?? []).map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2">
              {(board ?? []).map((column) => (
                <button
                  key={column.stage_id}
                  type="button"
                  onClick={() => {
                    setStageFilter(column.stage_id);
                    setTab('applications');
                    setPage(1);
                  }}
                  className="min-w-[9rem] flex-1 rounded-md border px-3 py-4 text-left transition-colors hover:border-primary"
                >
                  <div className="text-muted-foreground text-xs uppercase tracking-wide">{column.name}</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums">{column.applications}</div>
                  <div className="text-muted-foreground mt-1 text-xs capitalize">{column.type}</div>
                </button>
              ))}
            </div>

            {(interviews?.items ?? []).length > 0 ? (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Upcoming interviews</h3>
                {(interviews?.items ?? []).slice(0, 5).map((interview) => (
                  <div key={interview.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span className="font-medium">{interview.applicant_name ?? '—'}</span>
                    <span className="text-muted-foreground">
                      {interview.job_title} · {interview.scheduled_at?.slice(0, 16)} · {interview.mode}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {tab === 'applications' ? (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <EntityToolbar
              searchPlaceholder="Search by name, phone or email…"
              onSearchChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              onRefresh={() => void refetch()}
              isRefreshing={isFetching}
              onClearFilters={() => {
                setJobFilter('');
                setStageFilter('');
                setStatusFilter('');
                setPage(1);
              }}
              filterPanel={
                <>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">Job Opening</span>
                    <select
                      value={jobFilter}
                      onChange={(e) => {
                        setJobFilter(e.target.value);
                        setPage(1);
                      }}
                      className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                    >
                      <option value="">All</option>
                      {(jobs ?? []).map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">Stage</span>
                    <select
                      value={stageFilter}
                      onChange={(e) => {
                        setStageFilter(e.target.value);
                        setPage(1);
                      }}
                      className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                    >
                      <option value="">All</option>
                      {(stages ?? []).map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">Status</span>
                    <select
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setPage(1);
                      }}
                      className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                    >
                      <option value="">All</option>
                      <option value="in_pipeline">In Pipeline</option>
                      <option value="hold">Hold</option>
                      <option value="accepted">Accepted</option>
                      <option value="offer_sent">Offer Sent</option>
                      <option value="rejected">Rejected</option>
                      <option value="talent_pool">Talent Pool</option>
                    </select>
                  </div>
                </>
              }
            />

            <EntityTable<Application>
              columns={columns}
              data={items}
              getRowId={(a) => a.id}
              isLoading={isLoading}
              isError={isError}
              rowActions={(application) => (
                <ActionMenu
                  label={`Actions for ${application.applicant_name ?? 'applicant'}`}
                  items={[
                    {
                      key: 'open',
                      label: 'Open',
                      icon: Eye,
                      onSelect: () => navigate(`/hr/recruitment/applications/${application.id}`),
                    },
                  ]}
                />
              )}
            />

            {meta ? (
              <Pagination
                meta={{
                  page: meta.current_page,
                  perPage: meta.per_page,
                  total: meta.total,
                  lastPage: meta.last_page,
                }}
                onPageChange={setPage}
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {tab === 'jobs' ? (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground border-b text-left text-xs uppercase">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Reference</th>
                    <th className="py-2 pr-4 font-medium">Title</th>
                    <th className="py-2 pr-4 font-medium">Department</th>
                    <th className="py-2 pr-4 text-right font-medium">Positions</th>
                    <th className="py-2 pr-4 text-right font-medium">Applicants</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(jobs ?? []).map((job) => (
                    <tr key={job.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs">{job.reference}</td>
                      <td className="py-2 pr-4 font-medium">{job.title}</td>
                      <td className="text-muted-foreground py-2 pr-4">{job.department?.name ?? '—'}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {job.filled_count}/{job.openings_count}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{job.applications_count}</td>
                      <td className="py-2 pr-4">
                        <StatusBadge status={JOB_TONE[job.status]} label={job.status_label} />
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex gap-1">
                          {job.status === 'draft' || job.status === 'on_hold' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void transition.mutateAsync({ id: job.id, action: 'publish' })}
                            >
                              Publish
                            </Button>
                          ) : null}
                          {job.status === 'published' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void transition.mutateAsync({ id: job.id, action: 'close' })}
                            >
                              Close
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <EntityDrawer
        open={jobDrawer}
        onOpenChange={setJobDrawer}
        title="New Job Opening"
        description="Created as a draft — it reaches the public portal only when you publish it."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setJobDrawer(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitJob()} disabled={createJob.isPending}>
              {createJob.isPending ? 'Creating…' : 'Create Job'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="job_title">Title</Label>
            <Input id="job_title" value={jobForm.title} onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="job_department">Department</Label>
            <select
              id="job_department"
              value={jobForm.department_id}
              onChange={(e) => setJobForm({ ...jobForm, department_id: e.target.value })}
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
            >
              <option value="">Not assigned</option>
              {(departments ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="job_openings">Positions</Label>
              <Input
                id="job_openings"
                type="number"
                min={1}
                value={jobForm.openings_count}
                onChange={(e) => setJobForm({ ...jobForm, openings_count: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="job_location">Work location</Label>
              <Input
                id="job_location"
                value={jobForm.work_location}
                onChange={(e) => setJobForm({ ...jobForm, work_location: e.target.value })}
              />
            </div>
          </div>

          <p className="text-muted-foreground flex items-start gap-2 text-xs">
            <Users className="mt-0.5 size-3.5 shrink-0" />
            The salary band is stored but published only if you turn that on — the portal shows nothing you did not
            choose to show.
          </p>
        </div>
      </EntityDrawer>
    </div>
  );
}
