<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkflowSchedule extends Model
{
    use HasUuids;

    protected $table = 'automation_workflow_schedules';

    protected $fillable = [
        'workflow_id', 'cron_expression', 'timezone', 'next_run_at', 'last_run_at', 'is_active', 'created_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'next_run_at' => 'datetime',
        'last_run_at' => 'datetime',
    ];

    public function workflow(): BelongsTo
    {
        return $this->belongsTo(AutomationWorkflow::class, 'workflow_id');
    }
}
