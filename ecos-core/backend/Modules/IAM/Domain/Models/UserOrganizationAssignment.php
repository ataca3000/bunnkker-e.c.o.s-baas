<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A user's assignment to an organization unit (ADR-040). Additive; org_id is a nullable
 * string so unit types without a table yet (department/region/business_unit/cost_center)
 * are forward-compatible.
 *
 * @property string $org_type
 * @property ?string $org_id
 * @property bool $is_primary
 */
class UserOrganizationAssignment extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $table = 'user_organization_assignments';

    protected $fillable = [
        'user_id', 'org_type', 'org_id', 'org_label', 'is_primary', 'assigned_by', 'assigned_at',
    ];

    protected $casts = [
        'is_primary' => 'boolean',
        'assigned_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
