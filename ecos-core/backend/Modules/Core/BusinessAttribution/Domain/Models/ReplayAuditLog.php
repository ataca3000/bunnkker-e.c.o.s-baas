<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ReplayAuditLog extends Model
{
    use HasUuids;

    protected $table = 'bae_replay_audit_logs';

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'user_type',
        'target_entity_type',
        'target_entity_id',
        'target_dna_id',
        'replay_type',
        'replay_from',
        'replay_to',
        'replay_as_of',
        'replay_purpose',
        'events_replayed',
        'duration_ms',
        'status',
        'metadata',
        'executed_at',
        'created_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'replay_from' => 'datetime',
        'replay_to' => 'datetime',
        'replay_as_of' => 'datetime',
        'executed_at' => 'datetime',
        'created_at' => 'datetime',
    ];
}
