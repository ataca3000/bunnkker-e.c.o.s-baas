<?php

declare(strict_types=1);

namespace Modules\Hr\Performance\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Hr\Performance\Domain\Enums\GoalSubject;
use Modules\Hr\Performance\Domain\Enums\PerformanceStatus;

/** Target versus actual for one metric, one subject, one month. */
class PerformanceSnapshot extends Model
{
    use HasUuids;

    protected $table = 'hr_performance_snapshots';

    protected $fillable = [
        'company_id', 'goal_id', 'subject_type', 'subject_id', 'metric_key', 'period_month',
        'target_value', 'actual_value', 'achievement_percent', 'status',
        'fact_count', 'explanation', 'computed_at',
    ];

    protected function casts(): array
    {
        return [
            'subject_type' => GoalSubject::class,
            'status' => PerformanceStatus::class,
            'target_value' => 'decimal:4',
            'actual_value' => 'decimal:4',
            'achievement_percent' => 'decimal:2',
            'fact_count' => 'integer',
            'explanation' => 'array',
            'computed_at' => 'datetime',
        ];
    }

    public function goal(): BelongsTo
    {
        return $this->belongsTo(Goal::class, 'goal_id');
    }
}
