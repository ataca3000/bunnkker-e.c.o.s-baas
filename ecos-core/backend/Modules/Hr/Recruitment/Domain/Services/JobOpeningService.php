<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Modules\Hr\Recruitment\Domain\Enums\JobOpeningStatus;
use Modules\Hr\Recruitment\Domain\Exceptions\RecruitmentException;
use Modules\Hr\Recruitment\Domain\Models\JobOpening;

/**
 * Job openings — and the switch that puts one on the public internet.
 *
 * Publishing and closing are status changes, so a job can be opened or closed
 * without a deployment. The slug is generated once and kept stable, because a
 * published URL that changes is a broken link on somebody's job board.
 */
final class JobOpeningService
{
    public function create(string $companyId, array $data, ?int $actorId = null): JobOpening
    {
        return JobOpening::create([
            'company_id' => $companyId,
            'department_id' => $data['department_id'] ?? null,
            'branch_id' => $data['branch_id'] ?? null,
            'position_id' => $data['position_id'] ?? null,
            'employment_type_id' => $data['employment_type_id'] ?? null,
            'job_grade_id' => $data['job_grade_id'] ?? null,
            'reference' => $data['reference'] ?? $this->nextReference($companyId),
            'slug' => $this->uniqueSlug((string) $data['title']),
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'requirements' => $data['requirements'] ?? null,
            'responsibilities' => $data['responsibilities'] ?? null,
            'work_location' => $data['work_location'] ?? null,
            'work_mode' => $data['work_mode'] ?? 'onsite',
            'salary_min' => $data['salary_min'] ?? null,
            'salary_max' => $data['salary_max'] ?? null,
            'currency' => $data['currency'] ?? 'EGP',
            // Storing a range and publishing it are two different decisions.
            'show_salary' => $data['show_salary'] ?? false,
            'openings_count' => (int) ($data['openings_count'] ?? 1),
            'status' => JobOpeningStatus::Draft->value,
            'is_public' => $data['is_public'] ?? true,
            'closes_on' => $data['closes_on'] ?? null,
            'hiring_manager_employee_id' => $data['hiring_manager_employee_id'] ?? null,
            'created_by' => $actorId,
        ]);
    }

    public function update(JobOpening $opening, array $data): JobOpening
    {
        $opening->update(array_intersect_key($data, array_flip([
            'department_id', 'branch_id', 'position_id', 'employment_type_id', 'job_grade_id',
            'title', 'description', 'requirements', 'responsibilities', 'work_location', 'work_mode',
            'salary_min', 'salary_max', 'currency', 'show_salary', 'openings_count',
            'is_public', 'closes_on', 'hiring_manager_employee_id',
        ])));

        return $opening->refresh();
    }

    /** Put it on the careers portal. */
    public function publish(JobOpening $opening): JobOpening
    {
        $this->assertTransition($opening, JobOpeningStatus::Published);

        $opening->update([
            'status' => JobOpeningStatus::Published->value,
            'published_at' => $opening->published_at ?? Carbon::now(),
        ]);

        return $opening->refresh();
    }

    public function hold(JobOpening $opening): JobOpening
    {
        $this->assertTransition($opening, JobOpeningStatus::OnHold);
        $opening->update(['status' => JobOpeningStatus::OnHold->value]);

        return $opening->refresh();
    }

    public function close(JobOpening $opening): JobOpening
    {
        $this->assertTransition($opening, JobOpeningStatus::Closed);
        $opening->update(['status' => JobOpeningStatus::Closed->value, 'closed_at' => Carbon::now()]);

        return $opening->refresh();
    }

    /** Record a position filled, closing the opening once every seat is taken. */
    public function recordHire(JobOpening $opening): JobOpening
    {
        $filled = min((int) $opening->openings_count, (int) $opening->filled_count + 1);
        $isFull = $filled >= (int) $opening->openings_count;

        $opening->update([
            'filled_count' => $filled,
            'status' => $isFull && $opening->status->canTransitionTo(JobOpeningStatus::Filled)
                ? JobOpeningStatus::Filled->value
                : $opening->status->value,
            'closed_at' => $isFull ? Carbon::now() : $opening->closed_at,
        ]);

        return $opening->refresh();
    }

    /**
     * The openings the public may see. Company is deliberately optional: a
     * careers portal is usually served for one tenant, but the scope is what
     * guarantees safety, not the filter.
     *
     * @return \Illuminate\Database\Eloquent\Collection<int, JobOpening>
     */
    public function publiclyVisible(?string $companyId = null, array $filters = [])
    {
        return JobOpening::query()
            ->with(['department:id,name', 'employmentType:id,name'])
            ->publiclyVisible()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->when(! empty($filters['department_id']), fn ($q) => $q->where('department_id', $filters['department_id']))
            ->when(! empty($filters['branch_id']), fn ($q) => $q->where('branch_id', $filters['branch_id']))
            ->when(! empty($filters['work_mode']), fn ($q) => $q->where('work_mode', $filters['work_mode']))
            ->when(! empty($filters['search']), function ($q) use ($filters): void {
                $term = '%'.$filters['search'].'%';
                $q->where(fn ($inner) => $inner->where('title', 'like', $term)->orWhere('work_location', 'like', $term));
            })
            ->orderByDesc('published_at')
            ->limit(100)
            ->get();
    }

    private function assertTransition(JobOpening $opening, JobOpeningStatus $target): void
    {
        if (! $opening->status->canTransitionTo($target)) {
            throw RecruitmentException::invalidJobTransition($opening->status->value, $target->value);
        }
    }

    private function uniqueSlug(string $title): string
    {
        $base = Str::slug($title) ?: 'job';
        $slug = $base;
        $suffix = 2;

        while (JobOpening::withTrashed()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }

    private function nextReference(string $companyId): string
    {
        $last = JobOpening::withTrashed()
            ->where('company_id', $companyId)
            ->where('reference', 'like', 'JOB-%')
            ->orderByDesc('reference')
            ->value('reference');

        $next = $last === null ? 1 : ((int) substr((string) $last, 4)) + 1;

        return 'JOB-'.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
