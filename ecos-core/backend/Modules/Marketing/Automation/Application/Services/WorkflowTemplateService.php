<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Application\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Marketing\Automation\Domain\Enums\WorkflowStatus;
use Modules\Marketing\Automation\Domain\Models\AutomationWorkflow;
use Modules\Marketing\Automation\Domain\Models\AutomationWorkflowTemplate;

class WorkflowTemplateService
{
    public function list(array $filters = [], int $perPage = 25): LengthAwarePaginator
    {
        return AutomationWorkflowTemplate::query()
            ->where(fn ($q) => $q->where('is_global', true)->orWhere('company_id', $filters['company_id'] ?? null))
            ->when($filters['category'] ?? null, fn ($q, $v) => $q->where('category', $v))
            ->when($filters['search'] ?? null, fn ($q, $v) => $q->where('name', 'ilike', "%{$v}%"))
            ->where('is_active', true)
            ->orderByDesc('is_global')
            ->orderByDesc('usage_count')
            ->paginate($perPage);
    }

    public function create(array $data, string $userId): AutomationWorkflowTemplate
    {
        return AutomationWorkflowTemplate::create(array_merge($data, [
            'created_by' => $userId,
            'updated_by' => $userId,
        ]));
    }

    public function update(AutomationWorkflowTemplate $template, array $data, string $userId): AutomationWorkflowTemplate
    {
        $template->update(array_merge($data, ['updated_by' => $userId]));

        return $template->fresh();
    }

    public function delete(AutomationWorkflowTemplate $template): void
    {
        $template->delete();
    }

    public function createWorkflowFromTemplate(AutomationWorkflowTemplate $template, array $overrides, string $userId): AutomationWorkflow
    {
        $workflow = AutomationWorkflow::create([
            'name' => $overrides['name'] ?? "Workflow from: {$template->name}",
            'description' => $overrides['description'] ?? $template->description,
            'company_id' => $overrides['company_id'] ?? null,
            'brand_id' => $overrides['brand_id'] ?? null,
            'trigger_type' => $template->trigger_type->value,
            'status' => WorkflowStatus::DRAFT,
            'nodes_graph' => $template->nodes_graph,
            'created_by' => $userId,
            'updated_by' => $userId,
        ]);

        $template->increment('usage_count');

        return $workflow;
    }
}
