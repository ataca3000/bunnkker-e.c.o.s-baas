<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\Marketing\Automation\Domain\Enums\WorkflowTemplateCategory;
use Modules\Marketing\Automation\Domain\Enums\WorkflowTriggerType;

class AutomationWorkflowTemplate extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'automation_workflow_templates';

    protected $fillable = [
        'name', 'description', 'category', 'trigger_type', 'nodes_graph',
        'company_id', 'is_global', 'is_active', 'usage_count', 'created_by', 'updated_by',
    ];

    protected $casts = [
        'category' => WorkflowTemplateCategory::class,
        'trigger_type' => WorkflowTriggerType::class,
        'nodes_graph' => 'array',
        'is_global' => 'boolean',
        'is_active' => 'boolean',
    ];
}
