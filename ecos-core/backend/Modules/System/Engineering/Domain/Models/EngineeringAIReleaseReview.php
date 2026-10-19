<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\System\Engineering\Domain\Enums\ReviewRecommendation;

class EngineeringAIReleaseReview extends Model
{
    use HasUuids, SoftDeletes;
    protected $table = 'engineering_ai_release_reviews';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = [
        'company_id', 'review_id', 'release_id', 'recommendation', 'justification',
        'blocking_risks_count', 'warning_risks_count', 'passed_checks', 'failed_checks',
        'is_blocking', 'score_at_review', 'reviewed_at',
    ];
    protected function casts(): array
    {
        return [
            'recommendation'  => ReviewRecommendation::class,
            'is_blocking'     => 'boolean',
            'score_at_review' => 'float',
            'reviewed_at'     => 'datetime',
        ];
    }
    public function review(): BelongsTo
    {
        return $this->belongsTo(EngineeringAIReview::class, 'review_id');
    }
    public function release(): BelongsTo
    {
        return $this->belongsTo(EngineeringRelease::class, 'release_id');
    }
}
