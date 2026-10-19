<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/** A rule the assignment engine matches a ticket against to route it. */
class AssignmentRule extends Model
{
    use HasUuids;

    protected $table = 'crm_service_assignment_rules';

    protected $fillable = [
        'company_id', 'name', 'order', 'match_type', 'match_category', 'match_channel', 'match_priority',
        'strategy', 'assignee_id', 'team_id', 'team_member_ids', 'is_active',
    ];

    protected function casts(): array
    {
        return ['order' => 'integer', 'team_member_ids' => 'array', 'is_active' => 'boolean'];
    }
}
