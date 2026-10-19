<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Application\Services;

use Illuminate\Support\Facades\DB;
use Modules\Marketing\Automation\Domain\Models\WorkflowExecution;

class ConditionEvaluatorService
{
    /**
     * Evaluate a condition/branch node and return ['matched' => bool].
     * Evaluations are entity-context-aware — they query ECOS domain tables.
     */
    public function evaluate(WorkflowExecution $execution, array $node): array
    {
        $config = $node['config'] ?? [];
        $conditionType = $config['condition_type'] ?? '';
        $operator = $config['operator'] ?? 'equals';
        $value = $config['value'] ?? null;

        $matched = match ($conditionType) {
            'customer_segment' => $this->evaluateSegment($execution, $config),
            'order_count' => $this->evaluateNumeric($this->getOrderCount($execution), $operator, (int) $value),
            'purchase_value' => $this->evaluateNumeric($this->getPurchaseValue($execution), $operator, (float) $value),
            'ltv' => $this->evaluateNumeric($this->getLtv($execution), $operator, (float) $value),
            'last_activity' => $this->evaluateNumeric($this->getDaysSinceLastActivity($execution), $operator, (int) $value),
            'lead_score' => $this->evaluateNumeric($this->getLeadScore($execution), $operator, (float) $value),
            'custom_rule' => $this->evaluateCustomRule($execution, $config),
            default => false,
        };

        return ['matched' => $matched, 'condition_type' => $conditionType, 'operator' => $operator, 'value' => $value];
    }

    // ── Private evaluators ─────────────────────────────────────────────────────

    private function evaluateSegment(WorkflowExecution $execution, array $config): bool
    {
        $segmentId = $config['segment_id'] ?? null;
        if (! $segmentId) {
            return false;
        }

        return DB::table('automation_segment_memberships')
            ->where('segment_id', $segmentId)
            ->where('entity_type', $execution->entity_type)
            ->where('entity_id', $execution->entity_id)
            ->where('is_active', true)
            ->exists();
    }

    private function evaluateNumeric(float|int $actual, string $operator, float|int $expected): bool
    {
        return match ($operator) {
            'equals' => $actual === $expected,
            'not_equals' => $actual !== $expected,
            'greater_than' => $actual > $expected,
            'greater_or_equal' => $actual >= $expected,
            'less_than' => $actual < $expected,
            'less_or_equal' => $actual <= $expected,
            default => false,
        };
    }

    private function evaluateCustomRule(WorkflowExecution $execution, array $config): bool
    {
        // Custom rules are defined as JSON expressions — placeholder for future rule engine
        return false;
    }

    private function getOrderCount(WorkflowExecution $execution): int
    {
        if ($execution->entity_type !== 'customer') {
            return 0;
        }

        return (int) DB::table('orders')
            ->where('customer_id', $execution->entity_id)
            ->whereNotIn('status', ['cancelled', 'refunded'])
            ->count();
    }

    private function getPurchaseValue(WorkflowExecution $execution): float
    {
        if ($execution->entity_type !== 'customer') {
            return 0.0;
        }

        return (float) DB::table('orders')
            ->where('customer_id', $execution->entity_id)
            ->whereNotIn('status', ['cancelled', 'refunded'])
            ->sum('total_amount');
    }

    private function getLtv(WorkflowExecution $execution): float
    {
        return $this->getPurchaseValue($execution);
    }

    private function getDaysSinceLastActivity(WorkflowExecution $execution): int
    {
        $lastOrder = DB::table('orders')
            ->where('customer_id', $execution->entity_id)
            ->max('created_at');

        if (! $lastOrder) {
            return 9999;
        }

        return (int) now()->diffInDays(\Carbon\Carbon::parse($lastOrder));
    }

    private function getLeadScore(WorkflowExecution $execution): float
    {
        // Placeholder — lead score from CEP module
        return 0.0;
    }
}
