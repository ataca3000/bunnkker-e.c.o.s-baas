<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class AutomationGovernancePolicy extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'automation_governance_policies';

    protected $fillable = [
        'company_id', 'name', 'description',
        'max_executions_per_customer_per_day',
        'max_executions_per_customer_per_workflow',
        'max_total_executions_per_day',
        'quiet_hours_start', 'quiet_hours_end', 'quiet_hours_timezone',
        'blacklisted_channels', 'opt_out_rules', 'allowed_action_types',
        'requires_approval', 'is_default', 'is_active',
        'created_by', 'updated_by',
    ];

    protected $casts = [
        'blacklisted_channels' => 'array',
        'opt_out_rules' => 'array',
        'allowed_action_types' => 'array',
        'requires_approval' => 'boolean',
        'is_default' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function isInQuietHours(): bool
    {
        if (! $this->quiet_hours_start || ! $this->quiet_hours_end) {
            return false;
        }

        $tz = $this->quiet_hours_timezone ?? 'UTC';
        $now = now()->setTimezone($tz)->format('H:i:s');

        if ($this->quiet_hours_start <= $this->quiet_hours_end) {
            return $now >= $this->quiet_hours_start && $now <= $this->quiet_hours_end;
        }

        return $now >= $this->quiet_hours_start || $now <= $this->quiet_hours_end;
    }
}
