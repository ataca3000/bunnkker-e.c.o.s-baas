<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EngineeringWorkspaceSession extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'engineering_workspace_sessions';

    protected $fillable = [
        'session_id',
        'workspace_type',
        'status',
        'repository_path',
        'base_branch',
        'task_branch',
        'cache_hit',
        'provisioning_duration_ms',
        'provisioned_at',
        'activated_at',
        'released_at',
        'failure_reason',
    ];

    protected $casts = [
        'cache_hit'                => 'boolean',
        'provisioning_duration_ms' => 'integer',
        'provisioned_at'           => 'datetime',
        'activated_at'             => 'datetime',
        'released_at'              => 'datetime',
    ];

    public function executionSession(): BelongsTo
    {
        return $this->belongsTo(ExecutionSession::class, 'session_id');
    }
}
