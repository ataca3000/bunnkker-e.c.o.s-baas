<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

final class EngineeringResourceUsage extends Model
{
    use HasFactory;

    protected $table = 'engineering_resource_usage';

    protected $keyType = 'integer';

    public $incrementing = true;

    public $timestamps = false;

    protected $fillable = [
        'company_id',
        'cpu_percent',
        'memory_mb_used',
        'disk_gb_used',
        'active_workers',
        'idle_workers',
        'failed_workers',
        'queue_length',
        'running_sessions',
        'paused_sessions',
        'cluster_utilization_percent',
        'recorded_at',
    ];

    protected $casts = [
        'cpu_percent'                 => 'float',
        'disk_gb_used'                => 'float',
        'cluster_utilization_percent' => 'float',
        'memory_mb_used'              => 'integer',
        'active_workers'              => 'integer',
        'idle_workers'                => 'integer',
        'failed_workers'              => 'integer',
        'queue_length'                => 'integer',
        'running_sessions'            => 'integer',
        'paused_sessions'             => 'integer',
        'recorded_at'                 => 'datetime',
    ];
}
