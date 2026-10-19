import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Briefcase, CalendarCheck, FileText, Users } from 'lucide-react';

import { ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/crud';
import type { StatusVariant } from '@/components/crud/types';
import { Card, CardContent } from '@/components/ui/card';
import { useEmployee360Query } from '@/features/hr/hooks/use-hr';
import type { EmployeeStatus } from '@/features/hr/types/hr';
import { ROUTES } from '@/router/routes';

const STATUS_TONE: Record<EmployeeStatus, StatusVariant> = {
  active: 'active',
  probation: 'pending',
  on_leave: 'pending',
  suspended: 'inactive',
  resigned: 'archived',
  terminated: 'archived',
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium">{value ?? '—'}</span>
    </div>
  );
}

/**
 * Employee 360 — everything known about one person on a single page.
 *
 * Identity, placement, terms, reporting, documents and recent attendance. The
 * attendance panel is answered by the Attendance context through the H1 port, so
 * this page shows it without HR ever calculating it.
 */
export function Employee360Page() {
  const { t } = useTranslation('hr');
  const { employeeId = '' } = useParams();
  const { data, isLoading, isError, refetch } = useEmployee360Query(employeeId);

  if (isLoading) return <LoadingState />;
  if (isError || !data) return <ErrorState onRetry={() => void refetch()} />;

  const { identity, contact, placement, contract, reporting, documents, attendance } = data;
  const expiringDocuments = documents.filter((d) => d.is_expired || (d.days_until_expiry ?? 999) <= 60);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={identity.name}
        subtitle={`${identity.employee_number} · ${placement.position?.title ?? t($ => $.orgChart.noPosition)}`}
        breadcrumbs={[
          { label: t($ => $.employee360.breadcrumbWorkforce), to: ROUTES.hr },
          { label: t($ => $.employees.title), to: ROUTES.hrEmployees },
          { label: identity.name },
        ]}
        actions={<StatusBadge status={STATUS_TONE[identity.status]} label={identity.status_label} />}
      />

      {/* Attendance summary — owned by H2, surfaced here through the port. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">{t($ => $.employee360.stats.tenure)}</div>
            <div className="text-2xl font-bold">
              {placement.tenure_days === null
                ? '—'
                : t($ => $.employee360.stats.tenureDays, { count: placement.tenure_days })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">{t($ => $.employee360.stats.present30d)}</div>
            <div className="text-2xl font-bold text-emerald-600">{attendance.present}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">{t($ => $.employee360.stats.absent30d)}</div>
            <div className="text-2xl font-bold text-red-600">{attendance.absent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">{t($ => $.employee360.stats.attendanceRate)}</div>
            <div className="text-2xl font-bold">{attendance.attendance_rate_percent}%</div>
          </CardContent>
        </Card>
      </div>

      {expiringDocuments.length > 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertTriangle className="size-5 text-amber-600" />
            <div className="text-sm">{t($ => $.employee360.expiringDocuments, { count: expiringDocuments.length })}</div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <Briefcase className="size-4" />
              {t($ => $.employee360.placement.title)}
            </h2>
            <Field label={t($ => $.employee360.placement.department)} value={placement.department?.name} />
            <Field label={t($ => $.employee360.placement.position)} value={placement.position?.title} />
            <Field label={t($ => $.employee360.placement.jobGrade)} value={placement.job_grade?.name} />
            <Field label={t($ => $.employee360.placement.employmentType)} value={placement.employment_type?.name} />
            <Field label={t($ => $.employee360.placement.hireDate)} value={placement.hire_date} />
            {placement.termination_date ? (
              <Field label={t($ => $.employee360.placement.terminationDate)} value={placement.termination_date} />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <CalendarCheck className="size-4" />
              {t($ => $.employee360.contract.title)}
            </h2>
            {contract === null ? (
              <p className="text-muted-foreground text-sm">{t($ => $.employee360.contract.none)}</p>
            ) : (
              <>
                <Field label={t($ => $.employee360.contract.number)} value={contract.contract_number} />
                <Field label={t($ => $.employee360.contract.type)} value={contract.type} />
                <Field label={t($ => $.employee360.contract.status)} value={contract.status} />
                <Field label={t($ => $.employee360.contract.start)} value={contract.start_date} />
                <Field
                  label={t($ => $.employee360.contract.end)}
                  value={contract.end_date ?? t($ => $.employee360.contract.openEnded)}
                />
                <Field label={t($ => $.employee360.contract.weeklyHours)} value={contract.weekly_hours} />
                {contract.days_until_expiry !== null ? (
                  <Field label={t($ => $.employee360.contract.daysUntilExpiry)} value={contract.days_until_expiry} />
                ) : null}
              </>
            )}
            {/* Compensation is Payroll's — deliberately not shown or stored here. */}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <Users className="size-4" />
              {t($ => $.employee360.reporting.title)}
            </h2>
            <Field label={t($ => $.employee360.reporting.manager)} value={reporting.manager?.name} />
            <Field
              label={t($ => $.employee360.reporting.chain)}
              value={
                reporting.management_chain.length === 0
                  ? '—'
                  : reporting.management_chain.map((m) => m.name).join(' → ')
              }
            />
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs uppercase tracking-wide">
                {t($ => $.employee360.reporting.directReports, { count: reporting.direct_reports.length })}
              </span>
              {reporting.direct_reports.length === 0 ? (
                <span className="text-sm">—</span>
              ) : (
                <ul className="flex flex-col gap-1">
                  {reporting.direct_reports.map((report) => (
                    <li key={report.id} className="text-sm font-medium">
                      {report.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <h2 className="font-semibold">{t($ => $.employee360.contact.title)}</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t($ => $.employee360.contact.workEmail)} value={contact.work_email} />
              <Field label={t($ => $.employee360.contact.personalEmail)} value={contact.personal_email} />
              <Field label={t($ => $.employee360.contact.mobile)} value={contact.mobile} />
              <Field label={t($ => $.employee360.contact.phone)} value={contact.phone} />
              <Field label={t($ => $.employee360.contact.city)} value={contact.city} />
              <Field label={t($ => $.employee360.contact.country)} value={contact.country} />
              <Field label={t($ => $.employee360.contact.emergencyContact)} value={contact.emergency_contact_name} />
              <Field label={t($ => $.employee360.contact.emergencyPhone)} value={contact.emergency_contact_phone} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <FileText className="size-4" />
              {t($ => $.employee360.documents.title, { count: documents.length })}
            </h2>
            {documents.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t($ => $.employee360.documents.none)}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {documents.map((document) => (
                  <li key={document.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{document.title}</span>
                    <span
                      className={
                        document.is_expired
                          ? 'text-red-600'
                          : (document.days_until_expiry ?? 999) <= 60
                            ? 'text-amber-600'
                            : 'text-muted-foreground'
                      }
                    >
                      {document.expires_at
                        ? t($ => $.employee360.documents.expires, { date: document.expires_at })
                        : t($ => $.employee360.documents.noExpiry)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
