<?php

declare(strict_types=1);

namespace Modules\Admin\Configuration\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Immutable record of every configuration change.
 *
 * @property string $id
 * @property string $company_id
 * @property string|null $brand_id
 * @property string $module
 * @property string $category
 * @property string|null $config_key
 * @property array|null $old_value
 * @property array|null $new_value
 * @property string $action
 * @property string|null $actor_id
 * @property string|null $actor_name
 * @property string|null $reason
 * @property string $occurred_at
 */
class ConfigAuditEntry extends Model
{
    use HasUuids;

    protected $table = 'config_audit_log';

    public $incrementing = false;

    protected $keyType = 'string';

    public const CREATED_AT = null;

    public const UPDATED_AT = null;

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'brand_id',
        'module',
        'category',
        'config_key',
        'old_value',
        'new_value',
        'action',
        'actor_id',
        'actor_name',
        'reason',
        'requires_approval',
        'approval_status',
        'approved_by',
        'approved_at',
        'occurred_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'old_value' => 'array',
            'new_value' => 'array',
            'requires_approval' => 'boolean',
            'occurred_at' => 'datetime',
            'approved_at' => 'datetime',
        ];
    }
}
