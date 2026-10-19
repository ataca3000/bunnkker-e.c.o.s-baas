<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * PermissionGroup — Eloquent model for the `permission_groups` table
 * (TASK-IAM-002 / ADR-038, Part 3).
 *
 * The canonical group list lives in the {@see \Modules\IAM\Domain\Enums\PermissionGroup}
 * enum; this model is the persisted, relatable representation. Phase 1 = infrastructure
 * only — the table exists and can hold permissions, but no permission is grouped yet.
 *
 * @property string $id
 * @property string $code
 * @property string $name
 * @property ?string $icon
 * @property int $sort_order
 */
class PermissionGroup extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $table = 'permission_groups';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'code',
        'name',
        'icon',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
        ];
    }

    /**
     * @return HasMany<Permission>
     */
    public function permissions(): HasMany
    {
        return $this->hasMany(Permission::class, 'group_id');
    }
}
