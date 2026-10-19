<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\System\Engineering\Domain\Enums\ReviewDimension;

class EngineeringAIScore extends Model
{
    protected $table = 'engineering_ai_scores';
    protected $fillable = [
        'review_id', 'dimension', 'score', 'weight', 'weighted_score',
        'details', 'issues_found', 'passed_checks', 'failed_checks',
    ];
    protected function casts(): array
    {
        return [
            'dimension'      => ReviewDimension::class,
            'score'          => 'float',
            'weight'         => 'float',
            'weighted_score' => 'float',
            'details'        => 'array',
        ];
    }
    public function review(): BelongsTo
    {
        return $this->belongsTo(EngineeringAIReview::class, 'review_id');
    }
}
