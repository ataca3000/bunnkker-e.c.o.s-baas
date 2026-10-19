<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Models;
use Illuminate\Database\Eloquent\Model;

class EngineeringAIMetric extends Model
{
    public $timestamps = false;
    protected $table = 'engineering_ai_metrics';
    protected $fillable = [
        'company_id', 'metric_type', 'metric_key', 'metric_value', 'dimensions',
    ];
    protected function casts(): array
    {
        return [
            'metric_value' => 'float',
            'dimensions'   => 'array',
            'recorded_at'  => 'datetime',
        ];
    }
}
