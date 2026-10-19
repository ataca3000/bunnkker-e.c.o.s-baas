<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkflowVersion extends Model
{
    use HasUuids;

    protected $table = 'automation_workflow_versions';

    public $timestamps = false;

    protected $fillable = [
        'workflow_id', 'version_number', 'nodes_graph', 'trigger_type', 'changed_by', 'change_note',
    ];

    protected $casts = [
        'nodes_graph' => 'array',
        'created_at' => 'datetime',
    ];

    public function workflow(): BelongsTo
    {
        return $this->belongsTo(AutomationWorkflow::class, 'workflow_id');
    }
}
