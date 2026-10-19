<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkflowEventSubscription extends Model
{
    use HasUuids;

    protected $table = 'automation_workflow_event_subscriptions';

    protected $fillable = [
        'workflow_id', 'event_type', 'entity_type', 'filter_conditions', 'is_active',
    ];

    protected $casts = [
        'filter_conditions' => 'array',
        'is_active' => 'boolean',
    ];

    public function workflow(): BelongsTo
    {
        return $this->belongsTo(AutomationWorkflow::class, 'workflow_id');
    }
}
