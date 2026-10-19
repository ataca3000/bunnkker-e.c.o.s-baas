<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Models;
use Illuminate\Database\Eloquent\Model;

class EngineeringAITrend extends Model
{
    public $timestamps = false;
    protected $table = 'engineering_ai_trends';
    protected $fillable = [
        'company_id', 'period_type', 'period_label', 'overall_score',
        'dimension_scores', 'review_count', 'risk_count', 'recommendation_count',
        'avg_review_duration_seconds',
    ];
    protected function casts(): array
    {
        return [
            'overall_score'    => 'float',
            'dimension_scores' => 'array',
            'created_at'       => 'datetime',
        ];
    }
    protected $dates = ['created_at'];
}
