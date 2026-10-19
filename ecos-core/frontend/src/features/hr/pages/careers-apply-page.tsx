import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, MapPin } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePublicJobQuery, useSubmitApplication } from '@/features/hr/hooks/use-recruitment';
import type { ApplicationReceipt } from '@/features/hr/types/recruitment';

const money = (value: number, currency: string) =>
  `${currency} ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

/** The job page and its application form — public, and outside the app shell. */
export function CareersApplyPage() {
  const { t } = useTranslation('hr');
  const { slug = '' } = useParams();
  const { data: job, isLoading, isError } = usePublicJobQuery(slug);
  const submit = useSubmitApplication();

  const [receipt, setReceipt] = useState<ApplicationReceipt | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [cv, setCv] = useState<File | null>(null);

  const [form, setForm] = useState({
    full_name: '',
    mobile: '',
    email: '',
    birth_date: '',
    years_experience: '',
    current_employer: '',
    expected_salary: '',
    available_from: '',
    additional_notes: '',
  });

  const set = (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});

    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value !== '') payload.append(key, value);
    });
    if (cv) payload.append('cv', cv);

    try {
      setReceipt(await submit.mutateAsync({ slug, form: payload }));
    } catch (e) {
      const response = (e as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } }).response;
      setErrors(response?.data?.errors ?? { _: [response?.data?.message ?? t($ => $.careers.apply.submitFailed)] });
    }
  };

  if (isLoading) {
    return <p className="text-muted-foreground py-20 text-center text-sm">{t($ => $.common.loading)}</p>;
  }

  if (isError || !job) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-xl font-semibold">{t($ => $.careers.apply.unavailableTitle)}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t($ => $.careers.apply.unavailableHint)}</p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/careers">{t($ => $.careers.apply.backToRoles)}</Link>
        </Button>
      </div>
    );
  }

  // The receipt — a reference number, and nothing about our internal pipeline.
  if (receipt) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <CheckCircle2 className="size-10 text-emerald-600" />
            <h1 className="text-xl font-semibold">{receipt.message}</h1>
            <p className="text-muted-foreground text-sm">
              <Trans
                i18nKey="careers.apply.receiptBody"
                ns="hr"
                values={{ jobTitle: receipt.job_title, reference: receipt.reference }}
                components={{
                  title: <span className="font-medium" />,
                  ref: <span className="font-mono font-medium" />,
                }}
              />
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/careers">{t($ => $.careers.apply.backToRoles)}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ms-2">
          <Link to="/careers">
            <ArrowLeft className="size-4" />
            {t($ => $.careers.apply.allRoles)}
          </Link>
        </Button>

        <h1 className="text-3xl font-bold tracking-tight">{job.title}</h1>
        <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {job.department ? <span>{job.department}</span> : null}
          {job.employment_type ? <span>{job.employment_type}</span> : null}
          {job.work_location ? (
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" />
              {job.work_location}
            </span>
          ) : null}
          <span className="capitalize">{job.work_mode}</span>
        </div>

        {job.salary ? (
          <p className="mt-2 text-sm font-medium">
            {job.salary.min !== null ? money(job.salary.min, job.salary.currency) : '—'}
            {job.salary.max !== null ? ` – ${money(job.salary.max, job.salary.currency)}` : ''}
          </p>
        ) : null}

        {job.description ? (
          <section className="mt-8">
            <h2 className="font-semibold">{t($ => $.careers.apply.aboutRole)}</h2>
            <p className="text-muted-foreground mt-2 whitespace-pre-line text-sm">{job.description}</p>
          </section>
        ) : null}

        {job.responsibilities ? (
          <section className="mt-6">
            <h2 className="font-semibold">{t($ => $.careers.apply.responsibilities)}</h2>
            <p className="text-muted-foreground mt-2 whitespace-pre-line text-sm">{job.responsibilities}</p>
          </section>
        ) : null}

        {job.requirements ? (
          <section className="mt-6">
            <h2 className="font-semibold">{t($ => $.careers.apply.requirements)}</h2>
            <p className="text-muted-foreground mt-2 whitespace-pre-line text-sm">{job.requirements}</p>
          </section>
        ) : null}

        <Card className="mt-10">
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold">{t($ => $.careers.apply.applyHeading)}</h2>

            {!job.accepting_applications ? (
              <p className="text-muted-foreground mt-2 text-sm">{t($ => $.careers.apply.closed)}</p>
            ) : (
              <form className="mt-6 flex flex-col gap-5" onSubmit={onSubmit} noValidate>
                {errors._ ? <p className="text-destructive text-sm">{errors._[0]}</p> : null}

                <fieldset className="flex flex-col gap-4">
                  <legend className="text-sm font-medium">{t($ => $.careers.apply.yourDetails)}</legend>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t($ => $.careers.apply.fields.fullName)} name="full_name" errors={errors}>
                      <Input value={form.full_name} onChange={(e) => set('full_name')(e.target.value)} required />
                    </Field>
                    <Field label={t($ => $.careers.apply.fields.mobile)} name="mobile" errors={errors}>
                      <Input value={form.mobile} onChange={(e) => set('mobile')(e.target.value)} required />
                    </Field>
                    <Field label={t($ => $.careers.apply.fields.email)} name="email" errors={errors}>
                      <Input type="email" value={form.email} onChange={(e) => set('email')(e.target.value)} />
                    </Field>
                    <Field label={t($ => $.careers.apply.fields.birthDate)} name="birth_date" errors={errors}>
                      <Input type="date" value={form.birth_date} onChange={(e) => set('birth_date')(e.target.value)} />
                    </Field>
                  </div>
                </fieldset>

                <fieldset className="flex flex-col gap-4">
                  <legend className="text-sm font-medium">{t($ => $.careers.apply.yourExperience)}</legend>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t($ => $.careers.apply.fields.yearsExperience)} name="years_experience" errors={errors}>
                      <Input
                        type="number"
                        min={0}
                        step="0.5"
                        value={form.years_experience}
                        onChange={(e) => set('years_experience')(e.target.value)}
                      />
                    </Field>
                    <Field label={t($ => $.careers.apply.fields.currentEmployer)} name="current_employer" errors={errors}>
                      <Input
                        value={form.current_employer}
                        onChange={(e) => set('current_employer')(e.target.value)}
                      />
                    </Field>
                    <Field label={t($ => $.careers.apply.fields.expectedSalary)} name="expected_salary" errors={errors}>
                      <Input
                        type="number"
                        min={0}
                        value={form.expected_salary}
                        onChange={(e) => set('expected_salary')(e.target.value)}
                      />
                    </Field>
                    <Field label={t($ => $.careers.apply.fields.availableFrom)} name="available_from" errors={errors}>
                      <Input
                        type="date"
                        value={form.available_from}
                        onChange={(e) => set('available_from')(e.target.value)}
                      />
                    </Field>
                  </div>
                </fieldset>

                <Field label={t($ => $.careers.apply.fields.cv)} name="cv" errors={errors}>
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setCv(e.target.files?.[0] ?? null)}
                  />
                </Field>

                <Field label={t($ => $.careers.apply.fields.additionalNotes)} name="additional_notes" errors={errors}>
                  <textarea
                    value={form.additional_notes}
                    onChange={(e) => set('additional_notes')(e.target.value)}
                    rows={4}
                    className="border-input rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs"
                  />
                </Field>

                <Button type="submit" disabled={submit.isPending} className="self-start">
                  {submit.isPending ? t($ => $.careers.apply.submitting) : t($ => $.careers.apply.submitButton)}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** A labelled field that surfaces the server's validation message beneath it. */
function Field({
  label,
  name,
  errors,
  children,
}: {
  label: string;
  name: string;
  errors: Record<string, string[]>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {errors[name] ? <span className="text-destructive text-xs">{errors[name][0]}</span> : null}
    </div>
  );
}
