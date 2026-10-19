<?php

declare(strict_types=1);

namespace Modules\Hr\Performance\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Hr\Compensation\Domain\Enums\BonusType;
use Modules\Hr\Compensation\Domain\Services\BonusService;
use Modules\Hr\Compensation\Domain\Services\SalaryStructureService;
use Modules\Hr\Performance\Domain\Enums\GoalSubject;
use Modules\Hr\Performance\Domain\Enums\RecommendationStatus;
use Modules\Hr\Performance\Domain\Models\BonusRecommendation;
use Modules\Hr\Workforce\Domain\Models\Employee;

/**
 * Recommending bonuses from measured achievement.
 *
 * ┌─ THE BANDS ARE NAMED · THE MANAGER STILL DECIDES ───────────────────────┐
 * │ A recommendation is a percentage of basic salary chosen by an achievement  │
 * │ band. The bands are constants with names, so the number can be explained    │
 * │ and argued with rather than appearing from nowhere.                        │
 * │                                                                            │
 * │ Nothing is paid by this class. A recommendation becomes money only when a  │
 * │ manager approves or modifies it, and that decision is what creates the      │
 * │ bonus — which then still needs its own approval before it reaches a payslip.│
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class BonusRecommendationService
{
    /** Achievement band → share of basic salary recommended. */
    public const BANDS = [
        ['key' => 'outstanding', 'min_achievement' => 120.0, 'percent_of_basic' => 20.0],
        ['key' => 'exceeded', 'min_achievement' => 110.0, 'percent_of_basic' => 12.5],
        ['key' => 'achieved', 'min_achievement' => 100.0, 'percent_of_basic' => 7.5],
        ['key' => 'near_target', 'min_achievement' => 90.0, 'percent_of_basic' => 2.5],
    ];

    /** Below this, no recommendation is produced at all. */
    public const MINIMUM_ACHIEVEMENT = 90.0;

    public function __construct(
        private readonly PerformanceEvaluationService $evaluation,
        private readonly SalaryStructureService $salaries,
        private readonly BonusService $bonuses,
    ) {}

    /**
     * Produce a recommendation for one employee, or null when their achievement
     * does not reach the lowest band.
     */
    public function recommendFor(Employee $employee, string $periodMonth): ?BonusRecommendation
    {
        $overall = $this->evaluation->overallAchievement(
            (string) $employee->company_id, GoalSubject::Employee, (string) $employee->id, $periodMonth
        );

        if ($overall['goals'] === 0) {
            return null;
        }

        $achievement = (float) $overall['achievement_percent'];
        $band = $this->bandFor($achievement);

        if ($band === null) {
            return null;
        }

        $structure = $this->salaries->current($employee);
        $basic = $structure === null ? 0.0 : (float) $structure->basic_salary;

        if ($basic <= 0) {
            return null;
        }

        $amount = round($basic * ((float) $band['percent_of_basic'] / 100), 2);

        return BonusRecommendation::updateOrCreate(
            [
                'company_id' => $employee->company_id,
                'employee_id' => $employee->id,
                'period_month' => $periodMonth,
            ],
            [
                'achievement_percent' => $achievement,
                'recommended_amount' => $amount,
                'currency' => $structure->currency ?? 'EGP',
                'rule_key' => (string) $band['key'],
                'rationale' => sprintf(
                    '%s%% weighted achievement across %d goal(s) — %s band pays %s%% of basic salary.',
                    $achievement, $overall['goals'], $band['key'], $band['percent_of_basic']
                ),
                'explanation' => [
                    'achievement_percent' => $achievement,
                    'goals_evaluated' => $overall['goals'],
                    'targets_met' => $overall['met_targets'] ?? null,
                    'band' => $band,
                    'basic_salary' => $basic,
                    'formula' => 'recommended = basic salary × band percent',
                    'recommended_amount' => $amount,
                    'bands' => self::BANDS,
                ],
                'status' => RecommendationStatus::Pending->value,
            ]
        );
    }

    /**
     * Recommend across a whole company for a month.
     *
     * @return array{recommended: int, skipped: int}
     */
    public function recommendPeriod(string $companyId, string $periodMonth): array
    {
        $employees = Employee::query()
            ->where('company_id', $companyId)
            ->whereNotIn('status', ['terminated', 'resigned'])
            ->get();

        $recommended = 0;
        $skipped = 0;

        foreach ($employees as $employee) {
            $this->recommendFor($employee, $periodMonth) === null ? $skipped++ : $recommended++;
        }

        return ['recommended' => $recommended, 'skipped' => $skipped];
    }

    /** Approve at the recommended amount — and create the bonus. */
    public function approve(BonusRecommendation $recommendation, ?Employee $decidedBy = null, ?string $note = null): BonusRecommendation
    {
        return $this->decide($recommendation, RecommendationStatus::Approved, (float) $recommendation->recommended_amount, $decidedBy, $note);
    }

    /** Approve at a different amount — the manager's number wins, and is visible as an override. */
    public function modify(BonusRecommendation $recommendation, float $amount, ?Employee $decidedBy = null, ?string $note = null): BonusRecommendation
    {
        return $this->decide($recommendation, RecommendationStatus::Modified, round($amount, 2), $decidedBy, $note);
    }

    public function reject(BonusRecommendation $recommendation, ?Employee $decidedBy = null, ?string $note = null): BonusRecommendation
    {
        $recommendation->update([
            'status' => RecommendationStatus::Rejected->value,
            'decided_by_employee_id' => $decidedBy?->id,
            'decided_at' => Carbon::now(),
            'decision_note' => $note,
        ]);

        return $recommendation->refresh();
    }

    /** @return \Illuminate\Database\Eloquent\Collection<int, BonusRecommendation> */
    public function pending(string $companyId, ?string $periodMonth = null)
    {
        return BonusRecommendation::query()
            ->with('employee:id,first_name,last_name,employee_number')
            ->where('company_id', $companyId)
            ->where('status', RecommendationStatus::Pending->value)
            ->when($periodMonth !== null, fn ($q) => $q->where('period_month', $periodMonth))
            ->orderByDesc('achievement_percent')
            ->get();
    }

    /** @return array<int, array<string, mixed>> the bands, for the UI to explain itself */
    public function bands(): array
    {
        return self::BANDS;
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function decide(
        BonusRecommendation $recommendation,
        RecommendationStatus $status,
        float $amount,
        ?Employee $decidedBy,
        ?string $note,
    ): BonusRecommendation {
        return DB::transaction(function () use ($recommendation, $status, $amount, $decidedBy, $note): BonusRecommendation {
            $employee = $recommendation->employee;

            $bonus = $this->bonuses->award($employee, [
                'type' => BonusType::Performance->value,
                'amount' => $amount,
                'currency' => $recommendation->currency,
                'reason' => 'Performance bonus for '.$recommendation->period_month
                    .' ('.$recommendation->achievement_percent.'% achievement)',
                'awarded_on' => Carbon::parse($recommendation->period_month.'-01')->endOfMonth()->toDateString(),
                'source' => 'performance_recommendation',
                'recommendation_id' => (string) $recommendation->id,
            ], $decidedBy?->user_id === null ? null : (int) $decidedBy->user_id);

            $recommendation->update([
                'status' => $status->value,
                'decided_amount' => $amount,
                'decided_by_employee_id' => $decidedBy?->id,
                'decided_at' => Carbon::now(),
                'decision_note' => $note,
                'bonus_id' => (string) $bonus->id,
            ]);

            return $recommendation->refresh();
        });
    }

    /** @return array<string, mixed>|null */
    private function bandFor(float $achievement): ?array
    {
        if ($achievement < self::MINIMUM_ACHIEVEMENT) {
            return null;
        }

        foreach (self::BANDS as $band) {
            if ($achievement >= (float) $band['min_achievement']) {
                return $band;
            }
        }

        return null;
    }
}
