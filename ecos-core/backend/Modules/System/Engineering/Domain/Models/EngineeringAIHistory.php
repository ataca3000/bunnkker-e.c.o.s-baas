<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Models;
use Illuminate\Database\Eloquent\Model;

class EngineeringAIHistory extends Model
{
    public $timestamps = false;
    protected $table = 'engineering_ai_history';
    protected $fillable = [
        'company_id', 'review_id', 'subject_type', 'subject_id',
        'overall_score', 'recommendation', 'risk_summary', 'occurred_at',
    ];
    protected function casts(): array
    {
        return [
            'overall_score' => 'float',
            'risk_summary'  => 'array',
            'occurred_at'   => 'datetime',
        ];
    }
}
