<?php

declare(strict_types=1);

namespace Modules\Hr\Performance\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Hr\Performance\Domain\Enums\RecommendationStatus;
use Modules\Hr\Workforce\Domain\Models\Employee;

/** A suggested bonus, and what the manager did about it. */
class BonusRecommendation extends Model
{
    use HasUuids;

    protected $table = 'hr_bonus_recommendations';

    protected $fillable = [
        'company_id', 'employee_id', 'period_month', 'achievement_percent',
        'recommended_amount', 'decided_amount', 'currency', 'rule_key', 'rationale',
        'explanation', 'status', 'decided_by_employee_id', 'decided_at', 'decision_note', 'bonus_id',
    ];

    protected function casts(): array
    {
        return [
            'status' => RecommendationStatus::class,
            'achievement_percent' => 'decimal:2',
            'recommended_amount' => 'decimal:2',
            'decided_amount' => 'decimal:2',
            'explanation' => 'array',
            'decided_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    /** The amount that actually applies — the manager's, if they set one. */
    public function effectiveAmount(): float
    {
        return round((float) ($this->decided_amount ?? $this->recommended_amount), 2);
    }

    /** Did the manager change the number the system suggested? */
    public function wasOverridden(): bool
    {
        return $this->decided_amount !== null
            && abs((float) $this->decided_amount - (float) $this->recommended_amount) > 0.001;
    }
}
