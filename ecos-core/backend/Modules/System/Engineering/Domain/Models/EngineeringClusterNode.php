<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\System\Engineering\Domain\Enums\ClusterNodeStatus;

final class EngineeringClusterNode extends Model
{
    use HasFactory;
    use HasUuids;
    use SoftDeletes;

    protected $table = 'engineering_cluster_nodes';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'company_id',
        'node_name',
        'node_type',
        'status',
        'ip_address',
        'port',
        'worker_count',
        'max_workers',
        'cpu_usage_percent',
        'memory_mb_used',
        'memory_mb_total',
        'disk_gb_free',
        'metadata',
        'last_seen_at',
    ];

    protected function casts(): array
    {
        return [
            'status'            => ClusterNodeStatus::class,
            'cpu_usage_percent' => 'float',
            'memory_mb_used'    => 'integer',
            'memory_mb_total'   => 'integer',
            'disk_gb_free'      => 'float',
            'worker_count'      => 'integer',
            'max_workers'       => 'integer',
            'metadata'          => 'array',
            'last_seen_at'      => 'datetime',
        ];
    }

    // Helpers

    public function isHealthy(): bool
    {
        return $this->status->isHealthy() && $this->last_seen_at?->diffInMinutes(now()) < 2;
    }

    public function getUtilizationPercentAttribute(): float
    {
        return $this->max_workers > 0
            ? round($this->worker_count / $this->max_workers * 100, 2)
            : 0.0;
    }
}
