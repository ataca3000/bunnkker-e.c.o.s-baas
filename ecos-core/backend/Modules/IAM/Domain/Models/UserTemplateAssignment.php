<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A Role Template assigned to a user (ADR-040). Roles are ONLY assigned via templates —
 * there is no direct permission assignment.
 *
 * @property string $role_template_id
 * @property bool $is_primary
 */
class UserTemplateAssignment extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $table = 'user_template_assignments';

    protected $fillable = [
        'user_id', 'role_template_id', 'is_primary', 'assigned_by', 'assigned_at',
    ];

    protected $casts = [
        'is_primary' => 'boolean',
        'assigned_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(RoleTemplate::class, 'role_template_id');
    }
}
