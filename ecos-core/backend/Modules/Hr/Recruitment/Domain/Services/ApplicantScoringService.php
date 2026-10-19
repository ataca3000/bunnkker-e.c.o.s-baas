<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Services;

use Modules\Hr\Recruitment\Domain\Models\JobApplication;
use Modules\Hr\Recruitment\Domain\Models\JobOpening;

/**
 * A deterministic first read on how well a candidate fits an opening.
 *
 * ┌─ AI-READY, NOT AI ──────────────────────────────────────────────────────┐
 * │ Three things can be checked without judgement: whether the salary they      │
 * │ expect is inside the band, whether they can start soon, and whether their   │
 * │ application is complete enough to assess. That is what this scores, and it  │
 * │ returns the reasoning alongside the number.                                 │
 * │                                                                            │
 * │ It is deliberately NOT a hiring recommendation. Nothing here reads a CV,     │
 * │ infers competence, or ranks people against each other — a model that did    │
 * │ would be making a decision about someone's livelihood from a form. The       │
 * │ score is a sorting aid for a recruiter's first pass, and the seam where a    │
 * │ future model would plug in behind the same explainable contract.            │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class ApplicantScoringService
{
    /** Weights, named so the number can be argued with. */
    public const WEIGHT_SALARY_FIT = 40;

    public const WEIGHT_AVAILABILITY = 25;

    public const WEIGHT_COMPLETENESS = 35;

    /** Starting within this many days counts as immediately available. */
    public const IMMEDIATE_AVAILABILITY_DAYS = 30;

    /** @return array{score: int, explanation: array<string, mixed>} */
    public function score(JobApplication $application, JobOpening $opening): array
    {
        $salary = $this->salaryFit($application, $opening);
        $availability = $this->availability($application);
        $completeness = $this->completeness($application);

        $score = (int) round($salary['points'] + $availability['points'] + $completeness['points']);
        $score = max(0, min(100, $score));

        return [
            'score' => $score,
            'explanation' => [
                'components' => [
                    'salary_fit' => $salary,
                    'availability' => $availability,
                    'completeness' => $completeness,
                ],
                'weights' => [
                    'salary_fit' => self::WEIGHT_SALARY_FIT,
                    'availability' => self::WEIGHT_AVAILABILITY,
                    'completeness' => self::WEIGHT_COMPLETENESS,
                ],
                'score' => $score,
                'scope' => 'Screening aid only — it does not assess competence or rank candidates.',
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function salaryFit(JobApplication $application, JobOpening $opening): array
    {
        $expected = $application->expected_salary === null ? null : (float) $application->expected_salary;
        $min = $opening->salary_min === null ? null : (float) $opening->salary_min;
        $max = $opening->salary_max === null ? null : (float) $opening->salary_max;

        // With no band to compare against, this component is neutral rather than
        // a penalty — the candidate cannot be blamed for an unpublished range.
        if ($expected === null || ($min === null && $max === null)) {
            return [
                'points' => self::WEIGHT_SALARY_FIT * 0.5,
                'reason' => 'no salary band or no expectation stated — neutral',
                'expected' => $expected,
            ];
        }

        $withinBand = ($min === null || $expected >= $min) && ($max === null || $expected <= $max);

        if ($withinBand) {
            return ['points' => self::WEIGHT_SALARY_FIT, 'reason' => 'expectation is within the band', 'expected' => $expected];
        }

        if ($max !== null && $expected > $max) {
            // How far above — a small overshoot is not the same as double.
            $overshoot = ($expected - $max) / max(1.0, $max);
            $points = self::WEIGHT_SALARY_FIT * max(0.0, 1 - min(1.0, $overshoot * 2));

            return [
                'points' => round($points, 2),
                'reason' => 'expectation is above the band',
                'expected' => $expected,
                'band_max' => $max,
                'overshoot_percent' => round($overshoot * 100, 1),
            ];
        }

        return ['points' => self::WEIGHT_SALARY_FIT, 'reason' => 'expectation is below the band', 'expected' => $expected];
    }

    /** @return array<string, mixed> */
    private function availability(JobApplication $application): array
    {
        if ($application->available_from === null) {
            return ['points' => self::WEIGHT_AVAILABILITY * 0.5, 'reason' => 'no start date given — neutral'];
        }

        $days = (int) round(now()->startOfDay()->diffInDays($application->available_from->copy()->startOfDay(), false));

        if ($days <= 0) {
            return ['points' => self::WEIGHT_AVAILABILITY, 'reason' => 'available immediately', 'days' => $days];
        }

        $ratio = max(0.0, 1 - ($days / (self::IMMEDIATE_AVAILABILITY_DAYS * 3)));

        return [
            'points' => round(self::WEIGHT_AVAILABILITY * $ratio, 2),
            'reason' => "available in {$days} day(s)",
            'days' => $days,
        ];
    }

    /**
     * Whether there is enough on the application to assess it at all — the one
     * thing a recruiter genuinely needs before spending time on someone.
     *
     * @return array<string, mixed>
     */
    private function completeness(JobApplication $application): array
    {
        $applicant = $application->applicant;

        $checks = [
            'has_email' => $applicant?->email !== null,
            'has_experience' => $application->years_experience !== null,
            'has_current_employer' => $application->current_employer !== null,
            'has_cv' => $applicant !== null && $applicant->attachments()->where('type', 'cv')->exists(),
        ];

        $met = count(array_filter($checks));
        $points = self::WEIGHT_COMPLETENESS * ($met / max(1, count($checks)));

        return [
            'points' => round($points, 2),
            'reason' => "{$met} of ".count($checks).' details supplied',
            'checks' => $checks,
        ];
    }
}
