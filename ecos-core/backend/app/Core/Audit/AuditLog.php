<?php

declare(strict_types=1);

namespace App\Core\Audit;

use Illuminate\Database\Eloquent\Model;

final class AuditLog extends Model
{
    public $incrementing = false;

    public $timestamps = false;

    protected $keyType = 'string';

    protected $table = 'audit_logs';

    protected $fillable = [
        'id',
        'company_id',
        'user_id',
        'action',
        'entity_type',
        'entity_id',
        'old_values',
        'new_values',
        'metadata',
        'ip_address',
        'user_agent',
        'config_version_id',
        'policy_version',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'old_values' => 'array',
            'new_values' => 'array',
            'metadata' => 'array',
            'occurred_at' => 'datetime',
        ];
    }
}
