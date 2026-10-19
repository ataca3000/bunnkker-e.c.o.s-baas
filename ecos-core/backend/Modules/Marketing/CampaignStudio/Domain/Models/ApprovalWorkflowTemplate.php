<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ApprovalWorkflowTemplate extends Model
{
    use HasUuids;

    protected $table = 'marketing_approval_workflow_templates';

    protected $fillable = [
        'company_id', 'name', 'description',
        'is_default', 'is_active', 'created_by', 'updated_by',
    ];

    protected $casts = [
        'is_default' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function steps(): HasMany
    {
        return $this->hasMany(ApprovalWorkflowStep::class, 'workflow_template_id')
            ->orderBy('step_order');
    }
}
