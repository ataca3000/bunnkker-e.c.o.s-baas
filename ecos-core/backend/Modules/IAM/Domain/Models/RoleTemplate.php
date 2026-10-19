<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\IAM\Domain\Enums\RoleCategory;
use Modules\IAM\Domain\Enums\RoleTemplateStatus;
use Modules\IAM\Domain\ValueObjects\EffectiveRoleProfile;

/**
 * Enterprise Role Template — a complete, versioned business job profile (ADR-039).
 * Authoring layer: compiles down to the runtime Role + role_permissions.
 *
 * @property string $id
 * @property string $key
 * @property string $name
 * @property ?string $description
 * @property string $category
 * @property string $status
 * @property int $version
 * @property bool $is_system
 * @property bool $is_composable
 * @property array $definition
 * @property ?string $role_id
 */
class RoleTemplate extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $table = 'role_templates';

    protected $fillable = [
        'key', 'name', 'description', 'category', 'status', 'version',
        'is_system', 'is_composable', 'definition', 'role_id',
        'created_by', 'updated_by', 'published_at',
    ];

    protected $casts = [
        'is_system' => 'boolean',
        'is_composable' => 'boolean',
        'version' => 'integer',
        'definition' => 'array',
        'published_at' => 'datetime',
    ];

    public function versions(): HasMany
    {
        return $this->hasMany(RoleTemplateVersion::class, 'role_template_id')->orderByDesc('version');
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    public function categoryEnum(): RoleCategory
    {
        return RoleCategory::from($this->category);
    }

    public function statusEnum(): RoleTemplateStatus
    {
        return RoleTemplateStatus::from($this->status);
    }

    /** True when this official ECOS template must not be edited/deleted in place. */
    public function isImmutable(): bool
    {
        return $this->is_system;
    }

    /** The declarative profile as an immutable value object. */
    public function profile(): EffectiveRoleProfile
    {
        return EffectiveRoleProfile::fromArray($this->definition ?? [], [$this->key]);
    }
}
