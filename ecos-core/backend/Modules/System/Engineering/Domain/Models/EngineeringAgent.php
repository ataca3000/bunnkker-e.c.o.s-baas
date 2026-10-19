<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Modules\System\Engineering\Domain\Enums\AgentStatus;

final class EngineeringAgent extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $table = 'engineering_agents';

    protected $fillable = [
        'company_id',
        'name',
        'agent_type',
        'api_key_hash',
        'status',
        'machine_fingerprint',
        'os_info',
        'ip_address',
        'version',
        'capabilities',
        'platform_info',
        'last_seen_at',
        'registered_at',
        'deregistered_at',
        'created_by_id',
    ];

    protected $hidden = ['api_key_hash'];

    protected function casts(): array
    {
        return [
            'status'          => AgentStatus::class,
            'capabilities'    => 'array',
            'platform_info'   => 'array',
            'last_seen_at'    => 'datetime',
            'registered_at'   => 'datetime',
            'deregistered_at' => 'datetime',
        ];
    }

    // Relations

    public function heartbeats(): HasMany
    {
        return $this->hasMany(EngineeringAgentHeartbeat::class, 'agent_id')
            ->orderByDesc('recorded_at');
    }

    public function latestHeartbeat(): HasOne
    {
        return $this->hasOne(EngineeringAgentHeartbeat::class, 'agent_id')
            ->latestOfMany('recorded_at');
    }

    public function capabilities(): HasMany
    {
        return $this->hasMany(EngineeringAgentCapability::class, 'agent_id');
    }

    public function executionSessions(): HasMany
    {
        return $this->hasMany(ExecutionSession::class, 'agent_id');
    }

    public function currentSession(): HasOne
    {
        return $this->hasOne(ExecutionSession::class, 'agent_id')
            ->whereNotIn('status', ['completed', 'failed', 'aborted'])
            ->latestOfMany();
    }

    public function agentLogs(): HasMany
    {
        return $this->hasMany(EngineeringAgentLog::class, 'agent_id')
            ->orderByDesc('logged_at');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(EngineeringAgentVersion::class, 'agent_id');
    }

    // Helper methods

    public function isOnline(): bool
    {
        return $this->status->isActive() && $this->last_seen_at?->diffInMinutes(now()) < 5;
    }

    public function markSeen(): void
    {
        $this->update(['last_seen_at' => now()]);
    }
}
