<?php

declare(strict_types=1);

namespace Modules\Hr\Performance\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Modules\Hr\Performance\Domain\Enums\GoalSubject;

/** A measurable operational target for one employee or department, for one month. */
class Goal extends Model
{
    use HasUuids;

    protected $table = 'hr_goals';

    protected $fillable = [
        'company_id', 'subject_type', 'subject_id', 'metric_key', 'title',
        'target_value', 'comparison', 'weight', 'period_month', 'status', 'notes', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'subject_type' => GoalSubject::class,
            'target_value' => 'decimal:4',
            'weight' => 'integer',
        ];
    }

    /** Is a lower number the better outcome (shortages, failed deliveries)? */
    public function lowerIsBetter(): bool
    {
        return $this->comparison === 'lte';
    }

    /**
     * Achievement as a percentage of target.
     *
     * For a "lower is better" goal the ratio inverts, so coming in under target
     * scores above 100 the same way beating a sales number does.
     */
    public function achievement(float $actual): float
    {
        $target = (float) $this->target_value;

        if ($target == 0.0) {
            // No target to measure against: hitting zero on a "keep it down" goal
            // is a full pass; on a "reach this" goal there is nothing to score.
            return $this->lowerIsBetter() && $actual <= 0.0 ? 100.0 : 0.0;
        }

        $percent = $this->lowerIsBetter()
            ? ($actual <= 0.0 ? 200.0 : ($target / $actual) * 100)
            : ($actual / $target) * 100;

        // Cap the upside so one runaway month cannot distort a trend or a bonus band.
        return round(min(200.0, max(0.0, $percent)), 2);
    }
}
