<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Immutable snapshot of a Role Template at a published version (ADR-039).
 * Append-only — never updated or deleted.
 *
 * @property string $id
 * @property string $role_template_id
 * @property int $version
 * @property array $definition
 */
class RoleTemplateVersion extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    protected $table = 'role_template_versions';

    protected $fillable = [
        'role_template_id', 'version', 'key', 'name', 'category',
        'status', 'definition', 'change_note', 'created_by', 'created_at',
    ];

    protected $casts = [
        'version' => 'integer',
        'definition' => 'array',
        'created_at' => 'datetime',
    ];

    public function template(): BelongsTo
    {
        return $this->belongsTo(RoleTemplate::class, 'role_template_id');
    }
}
