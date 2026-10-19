<?php

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Model;

class RepairMetric extends Model
{
    protected $table = 'engineering_repair_metrics';

    public $timestamps = false;

    public $incrementing = true;

    protected $keyType = 'int';

    protected $fillable = [
        'company_id',
        'metric_type',
        'metric_key',
        'metric_value',
        'dimensions',
        'recorded_at',
    ];

    public function casts(): array
    {
        return [
            'metric_value' => 'float',
            'dimensions'   => 'array',
            'recorded_at'  => 'datetime',
        ];
    }
}
