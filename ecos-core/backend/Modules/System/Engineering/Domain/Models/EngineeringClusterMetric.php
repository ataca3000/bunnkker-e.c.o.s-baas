<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

final class EngineeringClusterMetric extends Model
{
    use HasFactory;

    protected $table = 'engineering_cluster_metrics';

    protected $keyType = 'integer';

    public $incrementing = true;

    public $timestamps = false;

    protected $fillable = [
        'company_id',
        'metric_type',
        'value',
        'unit',
        'dimensions',
        'recorded_at',
    ];

    protected $casts = [
        'value'       => 'float',
        'dimensions'  => 'array',
        'recorded_at' => 'datetime',
    ];
}
