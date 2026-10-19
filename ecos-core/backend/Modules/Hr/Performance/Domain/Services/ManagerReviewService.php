<?php

declare(strict_types=1);

namespace Modules\Hr\Performance\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Hr\Performance\Domain\Models\ManagerReview;
use Modules\Hr\Workforce\Domain\Models\Employee;

/** Manager reviews — a rating and three notes, once per employee per month. */
final class ManagerReviewService
{
    public function save(Employee $employee, string $periodMonth, array $data, ?Employee $reviewer = null, ?int $actorId = null): ManagerReview
    {
        return ManagerReview::updateOrCreate(
            [
                'company_id' => $employee->company_id,
                'employee_id' => $employee->id,
                'period_month' => $periodMonth,
            ],
            [
                'reviewer_employee_id' => $reviewer?->id,
                'overall_rating' => max(1, min(5, (int) ($data['overall_rating'] ?? 3))),
                'strengths' => $data['strengths'] ?? null,
                'improvement_notes' => $data['improvement_notes'] ?? null,
                'manager_comments' => $data['manager_comments'] ?? null,
                'status' => $data['status'] ?? 'draft',
                'created_by' => $actorId,
            ]
        );
    }

    public function submit(ManagerReview $review): ManagerReview
    {
        $review->update(['status' => 'submitted', 'submitted_at' => Carbon::now()]);

        return $review->refresh();
    }

    /** @return \Illuminate\Database\Eloquent\Collection<int, ManagerReview> */
    public function forPeriod(string $companyId, string $periodMonth)
    {
        return ManagerReview::query()
            ->with('employee:id,first_name,last_name,employee_number')
            ->where('company_id', $companyId)
            ->where('period_month', $periodMonth)
            ->orderByDesc('overall_rating')
            ->get();
    }

    /** @return \Illuminate\Database\Eloquent\Collection<int, ManagerReview> */
    public function historyFor(Employee $employee, int $months = 12)
    {
        $earliest = Carbon::now()->subMonthsNoOverflow($months - 1)->format('Y-m');

        return ManagerReview::query()
            ->where('employee_id', $employee->id)
            ->where('period_month', '>=', $earliest)
            ->orderByDesc('period_month')
            ->get();
    }
}
