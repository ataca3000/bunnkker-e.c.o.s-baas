<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\System\Engineering\Domain\Enums\ReviewStatus;
use Modules\System\Engineering\Domain\Enums\ReviewRecommendation;

class EngineeringAIReview extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'engineering_ai_reviews';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'company_id', 'review_type', 'status', 'subject_type', 'subject_id',
        'triggered_by', 'triggered_at', 'started_at', 'completed_at',
        'overall_score', 'recommendation', 'justification', 'summary', 'dimensions',
        'risk_count_critical', 'risk_count_high', 'risk_count_medium', 'risk_count_low',
        'is_blocking', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'status'           => ReviewStatus::class,
            'recommendation'   => ReviewRecommendation::class,
            'dimensions'       => 'array',
            'is_blocking'      => 'boolean',
            'overall_score'    => 'float',
            'triggered_at'     => 'datetime',
            'started_at'       => 'datetime',
            'completed_at'     => 'datetime',
        ];
    }

    public function scores(): HasMany
    {
        return $this->hasMany(EngineeringAIScore::class, 'review_id');
    }

    public function risks(): HasMany
    {
        return $this->hasMany(EngineeringAIRisk::class, 'review_id');
    }

    public function recommendations(): HasMany
    {
        return $this->hasMany(EngineeringAIRecommendation::class, 'review_id');
    }

    public function architectureChecks(): HasMany
    {
        return $this->hasMany(EngineeringAIArchitectureCheck::class, 'review_id');
    }

    public function securityChecks(): HasMany
    {
        return $this->hasMany(EngineeringAISecurityCheck::class, 'review_id');
    }

    public function releaseReviews(): HasMany
    {
        return $this->hasMany(EngineeringAIReleaseReview::class, 'review_id');
    }

    public function isTerminal(): bool
    {
        return $this->status?->isTerminal() ?? false;
    }

    public function hasCriticalRisks(): bool
    {
        return $this->risk_count_critical > 0;
    }
}
