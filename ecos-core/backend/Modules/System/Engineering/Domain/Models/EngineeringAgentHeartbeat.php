<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\System\Engineering\Domain\Enums\AgentStatus;

final class EngineeringAgentHeartbeat extends Model
{
    use HasFactory;

    protected $table = 'engineering_agent_heartbeats';

    protected $primaryKey = 'id';

    protected $keyType = 'integer';

    public $incrementing = true;

    public $timestamps = false;

    protected $fillable = [
        'agent_id',
        'status',
        'cpu_percent',
        'memory_mb_used',
        'disk_free_gb',
        'current_task_id',
        'load_average',
        'extra',
        'recorded_at',
    ];

    protected function casts(): array
    {
        return [
            'status'         => AgentStatus::class,
            'cpu_percent'    => 'float',
            'disk_free_gb'   => 'float',
            'load_average'   => 'float',
            'memory_mb_used' => 'integer',
            'extra'          => 'array',
            'recorded_at'    => 'datetime',
        ];
    }

    // Relations

    public function agent(): BelongsTo
    {
        return $this->belongsTo(EngineeringAgent::class, 'agent_id');
    }
}
