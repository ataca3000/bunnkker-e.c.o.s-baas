<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkflowExecutionStep extends Model
{
    use HasUuids;

    protected $table = 'automation_workflow_execution_steps';

    public $timestamps = false;

    protected $fillable = [
        'execution_id', 'node_id', 'node_type', 'action_type',
        'status', 'input', 'output', 'error', 'duration_ms', 'executed_at',
    ];

    protected $casts = [
        'input' => 'array',
        'output' => 'array',
        'executed_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    public function execution(): BelongsTo
    {
        return $this->belongsTo(WorkflowExecution::class, 'execution_id');
    }
}
