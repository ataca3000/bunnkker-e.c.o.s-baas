import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarPlus, Check, Star, UserPlus, X } from 'lucide-react';

import { ConfirmDialog, EntityDrawer, ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/crud';
import type { StatusVariant } from '@/components/crud/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useApplicationQuery,
  useDecideApplication,
  useEvaluateApplication,
  useHireApplicant,
  useHirePrefillQuery,
  useMoveStage,
  useScheduleInterview,
  useStagesQuery,
} from '@/features/hr/hooks/use-recruitment';
import type { ApplicationStatusKey } from '@/features/hr/types/recruitment';
import { ROUTES } from '@/router/routes';

const TONE: Record<ApplicationStatusKey, StatusVariant> = {
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

/**
 * One candidacy — the pipeline, the evaluations, the interviews, and the hire.
 *
 * The hire form is prefilled from what the recruiter already captured, so nobody
 * retypes a name, a department or an agreed salary.
 */
export function ApplicationDetailPage() {
  const { applicationId = '' } = useParams();

  const [evalDrawer, setEvalDrawer] = useState(false);
  const [interviewDrawer, setInterviewDrawer] = useState(false);
  const [hireDrawer, setHireDrawer] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [evaluation, setEvaluation] = useState({ rating: 'good', comments: '' });
  const [interview, setInterview] = useState({ scheduled_at: '', mode: 'onsite', location: '' });
  const [hire, setHire] = useState({ hire_date: '', basic_salary: '', contract_type: 'permanent' });

  const { data, isLoading, isError, refetch } = useApplicationQuery(applicationId);
  const { data: stages } = useStagesQuery();
  const { data: prefill } = useHirePrefillQuery(applicationId, hireDrawer);

  const moveStage = useMoveStage();
  const decide = useDecideApplication();
  const evaluate = useEvaluateApplication();
  const schedule = useScheduleInterview();
  const hireApplicant = useHireApplicant();

  if (isLoading) return <LoadingState />;
  if (isError || !data) return <ErrorState onRetry={() => void refetch()} />;

  const applicant = data.applicant;

  const openHire = () => {
    setHire({
      hire_date: new Date().toISOString().slice(0, 10),
      basic_salary: data.expected_salary ? String(data.expected_salary) : '',
      contract_type: 'permanent',
    });
    setHireDrawer(true);
  };

  const submitHire = async () => {
    setError(null);
    try {
      await hireApplicant.mutateAsync({
        applicationId,
        hire_date: hire.hire_date || undefined,
        basic_salary: hire.basic_salary ? Number(hire.basic_salary) : undefined,
        contract_type: hire.contract_type,
        department_id: prefill?.department_id ?? undefined,
        position_id: prefill?.position_id ?? undefined,
        reporting_manager_employee_id: prefill?.reporting_manager_employee_id ?? undefined,
      });
      setHireDrawer(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The hire could not be completed.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={applicant?.full_name ?? 'Applicant'}
        subtitle={`${data.application_number} · ${data.job_title ?? ''}`}
        breadcrumbs={[
          { label: 'Workforce', to: ROUTES.hr },
          { label: 'Recruitment', to: ROUTES.hrRecruitment },
          { label: applicant?.full_name ?? 'Application' },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setEvalDrawer(true)}>
              <Star className="size-4" />
              Evaluate
            </Button>
            <Button size="sm" variant="outline" onClick={() => setInterviewDrawer(true)}>
              <CalendarPlus className="size-4" />
              Interview
            </Button>
            {data.status === 'in_pipeline' || data.status === 'hold' ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void decide.mutateAsync({ id: applicationId, status: 'accepted' })}
                >
                  <Check className="size-4" />
                  Accept
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRejecting(true)}>
                  <X className="size-4" />
                  Reject
                </Button>
              </>
            ) : null}
            {data.can_be_hired ? (
              <Button size="sm" onClick={openHire}>
                <UserPlus className="size-4" />
                Hire
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Status</div>
            <div className="mt-1">
              <StatusBadge status={TONE[data.status]} label={data.status_label} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Stage</div>
            <div className="text-lg font-semibold">{data.stage?.name ?? '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Average Score</div>
            <div className="text-2xl font-bold">{data.average_score ?? '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm" title="Screening aid — not a competence assessment">
              Screening Fit
            </div>
            <div className="text-2xl font-bold">{data.match_score ?? '—'}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <h2 className="font-semibold">Applicant</h2>
            <Detail label="Mobile" value={applicant?.mobile} />
            <Detail label="Email" value={applicant?.email} />
            <Detail label="Experience" value={data.years_experience === null ? null : `${data.years_experience} years`} />
            <Detail label="Current employer" value={data.current_employer} />
            <Detail label="Expected salary" value={data.expected_salary === null ? null : String(data.expected_salary)} />
            <Detail label="Available from" value={data.available_from} />
            <Detail label="Source" value={data.source} />

            {applicant?.attachments && applicant.attachments.length > 0 ? (
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs uppercase tracking-wide">Attachments</span>
                {applicant.attachments.map((file) => (
                  <span key={file.id} className="text-sm">
                    {file.title} — {file.file_name}
                  </span>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Pipeline</h2>
              <select
                value={data.stage?.id ?? ''}
                onChange={(e) => void moveStage.mutateAsync({ id: applicationId, stage_id: e.target.value })}
                className="border-input h-8 rounded-md border bg-transparent px-2 text-sm shadow-xs"
              >
                {(stages ?? []).map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </div>

            <ul className="flex flex-col gap-2">
              {data.history.map((entry, index) => (
                <li key={index} className="rounded-md border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium capitalize">{entry.action.replace('_', ' ')}</span>
                    <span className="text-muted-foreground text-xs">{entry.occurred_at?.slice(0, 16)}</span>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {entry.from_stage ? `${entry.from_stage} → ` : ''}
                    {entry.to_stage ?? entry.to_status ?? ''}
                    {entry.note ? ` · ${entry.note}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <h2 className="font-semibold">Evaluations &amp; Interviews</h2>

            {data.evaluations.length === 0 ? (
              <p className="text-muted-foreground text-sm">No evaluations yet.</p>
            ) : (
              data.evaluations.map((e) => (
                <div key={e.id} className="rounded-md border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{e.rating_label}</span>
                    <span className="tabular-nums">{e.score}</span>
                  </div>
                  {e.comments ? <p className="text-muted-foreground text-xs">{e.comments}</p> : null}
                  <p className="text-muted-foreground text-xs">
                    {e.reviewer ?? 'Reviewer'} · {e.evaluated_at?.slice(0, 10)}
                  </p>
                </div>
              ))
            )}

            {data.interviews.map((i) => (
              <div key={i.id} className="rounded-md border px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{i.title ?? 'Interview'}</span>
                  <span className="text-muted-foreground text-xs capitalize">{i.status}</span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {i.scheduled_at?.slice(0, 16)} · {i.mode}
                  {i.interviewer ? ` · ${i.interviewer}` : ''}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Evaluate */}
      <EntityDrawer
        open={evalDrawer}
        onOpenChange={setEvalDrawer}
        title="Record Evaluation"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEvalDrawer(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                await evaluate.mutateAsync({ id: applicationId, ...evaluation });
                setEvalDrawer(false);
              }}
              disabled={evaluate.isPending}
            >
              Save
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rating">Rating</Label>
            <select
              id="rating"
              value={evaluation.rating}
              onChange={(e) => setEvaluation({ ...evaluation, rating: e.target.value })}
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
            >
              <option value="excellent">Excellent</option>
              <option value="very_good">Very Good</option>
              <option value="good">Good</option>
              <option value="average">Average</option>
              <option value="weak">Weak</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="comments">Comments</Label>
            <textarea
              id="comments"
              rows={4}
              value={evaluation.comments}
              onChange={(e) => setEvaluation({ ...evaluation, comments: e.target.value })}
              className="border-input rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs"
            />
          </div>
        </div>
      </EntityDrawer>

      {/* Schedule interview */}
      <EntityDrawer
        open={interviewDrawer}
        onOpenChange={setInterviewDrawer}
        title="Schedule Interview"
        description="Scheduling announces the interview — a calendar or notifier picks it up from there."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setInterviewDrawer(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                await schedule.mutateAsync({ applicationId, ...interview });
                setInterviewDrawer(false);
              }}
              disabled={schedule.isPending || !interview.scheduled_at}
            >
              Schedule
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="scheduled_at">When</Label>
            <Input
              id="scheduled_at"
              type="datetime-local"
              value={interview.scheduled_at}
              onChange={(e) => setInterview({ ...interview, scheduled_at: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mode">Mode</Label>
            <select
              id="mode"
              value={interview.mode}
              onChange={(e) => setInterview({ ...interview, mode: e.target.value })}
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
            >
              <option value="onsite">On site</option>
              <option value="phone">Phone</option>
              <option value="video">Video</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location">Location or link</Label>
            <Input
              id="location"
              value={interview.location}
              onChange={(e) => setInterview({ ...interview, location: e.target.value })}
            />
          </div>
        </div>
      </EntityDrawer>

      {/* Hire */}
      <EntityDrawer
        open={hireDrawer}
        onOpenChange={setHireDrawer}
        title="Hire Applicant"
        description="Creates the employee, contract, salary, reporting line and history in one step."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setHireDrawer(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitHire()} disabled={hireApplicant.isPending}>
              {hireApplicant.isPending ? 'Hiring…' : 'Confirm Hire'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          {prefill ? (
            <p className="text-muted-foreground text-xs">
              Prefilled from the application — {prefill.applicant.full_name}, expecting{' '}
              {prefill.expected_salary ?? '—'}
              {prefill.salary_range.min !== null
                ? ` (band ${prefill.salary_range.min}–${prefill.salary_range.max ?? '—'})`
                : ''}
              .
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hire_date">Start date</Label>
            <Input
              id="hire_date"
              type="date"
              value={hire.hire_date}
              onChange={(e) => setHire({ ...hire, hire_date: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="basic_salary">Basic salary</Label>
            <Input
              id="basic_salary"
              type="number"
              min={0}
              value={hire.basic_salary}
              onChange={(e) => setHire({ ...hire, basic_salary: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contract_type">Contract type</Label>
            <select
              id="contract_type"
              value={hire.contract_type}
              onChange={(e) => setHire({ ...hire, contract_type: e.target.value })}
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
            >
              <option value="permanent">Permanent</option>
              <option value="fixed_term">Fixed Term</option>
              <option value="probation">Probation</option>
              <option value="contractor">Contractor</option>
            </select>
          </div>
        </div>
      </EntityDrawer>

      <ConfirmDialog
        open={rejecting}
        onOpenChange={setRejecting}
        title="Reject Application"
        description={`Reject ${applicant?.full_name ?? 'this applicant'}? They can still be moved to the talent pool afterwards.`}
        confirmLabel="Reject"
        variant="destructive"
        loading={decide.isPending}
        onConfirm={async () => {
          await decide.mutateAsync({ id: applicationId, status: 'rejected' });
          setRejecting(false);
        }}
      />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium">{value ?? '—'}</span>
    </div>
  );
}
