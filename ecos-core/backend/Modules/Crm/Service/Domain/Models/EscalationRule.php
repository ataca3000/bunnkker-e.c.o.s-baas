<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/** A rule the escalation engine applies when an SLA target is breached or a case is idle. */
class EscalationRule extends Model
{
    use HasUuids;

    protected $table = 'crm_service_escalation_rules';

    protected $fillable = [
        'company_id', 'name', 'trigger', 'match_priority', 'idle_minutes',
        'reassign_to_user_id', 'reassign_to_team_id', 'is_active',
    ];

    protected function casts(): array
    {
        return ['idle_minutes' => 'integer', 'is_active' => 'boolean'];
    }
}
