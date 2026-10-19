<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingService\Application\DTOs\Responses;

use Modules\Manufacturing\ManufacturingPlanner\Domain\ValueObjects\NegativeStockDecision;
use Modules\Manufacturing\ManufacturingWorkflow\Domain\ValueObjects\ManufacturingWorkflowResult;

/**
 * Immutable response from ManufacturingApplicationService::simulateManufacturing().
 *
 * Shows exactly what WOULD happen if manufactureProduct() were called,
 * without touching inventory. Safe to call repeatedly — zero side effects.
 *
 * can_manufacture = true means the full workflow produced a ready plan
 * with no blocking conditions. Manufacturing CAN proceed if execute() is called.
 *
 * is_blocked = true means some engine stopped the workflow.
 * Check blocking_reason and blocking_stage for details.
 */
final readonly class SimulateManufacturingResponse
{
    /**
     * @param  list<array<string, mixed>>  $components  ComponentConsumptionPlan summaries
     * @param  list<array<string, mixed>>  $negative_stock_risks  NegativeStockDecision summaries
     */
    public function __construct(
        public string $workflow_id,
        public string $workflow_stage,
        public bool $can_manufacture,
        public bool $is_blocked,
        public ?string $blocking_reason,
        public float $qty_to_manufacture,
        public array $components,
        public array $negative_stock_risks,
        public ?string $decision_type,
        public ?string $availability_eligibility,
        public ?string $recipe_id,
        public ?int $bom_version_number,
        public array $metadata,
    ) {}

    public static function fromWorkflow(ManufacturingWorkflowResult $result): self
    {
        $plan = $result->plan;
        $components = [];
        $negativeStockRisks = [];

        if ($plan !== null) {
            foreach ($plan->components as $component) {
                $components[] = [
                    'component_id' => $component->component_id,
                    'sku' => $component->sku,
                    'name' => $component->name,
                    'unit_symbol' => $component->unit_symbol,
                    'qty_to_consume' => $component->qty_to_consume,
                    'available_qty' => $component->available_qty,
                    'missing_qty' => $component->missing_qty,
                    'will_go_negative' => $component->will_go_negative,
                    'is_blocked' => $component->is_blocked,
                    'allow_negative_stock' => $component->allow_negative_stock,
                ];
            }

            foreach ($plan->negative_stock_decisions as $decision) {
                $negativeStockRisks[] = [
                    'component_id' => $decision->component_id,
                    'sku' => $decision->sku,
                    'name' => $decision->name,
                    'available_qty' => $decision->available_qty,
                    'qty_to_consume' => $decision->qty_to_consume,
                    'projected_balance' => $decision->projected_balance,
                ];
            }
        }

        return new self(
            workflow_id: $result->workflow_id,
            workflow_stage: $result->stage->value,
            can_manufacture: $result->isPlanReady(),
            is_blocked: $result->is_blocked,
            blocking_reason: $result->blocking_reason?->value,
            qty_to_manufacture: $plan?->qty_to_manufacture ?? 0.0,
            components: $components,
            negative_stock_risks: $negativeStockRisks,
            decision_type: $result->decision_result?->decision->value,
            availability_eligibility: $result->availability_result?->eligibility->value,
            recipe_id: $plan?->recipe_id,
            bom_version_number: $plan?->bom_version_number,
            metadata: $result->metadata,
        );
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'workflow_id' => $this->workflow_id,
            'workflow_stage' => $this->workflow_stage,
            'can_manufacture' => $this->can_manufacture,
            'is_blocked' => $this->is_blocked,
            'blocking_reason' => $this->blocking_reason,
            'qty_to_manufacture' => $this->qty_to_manufacture,
            'components' => $this->components,
            'negative_stock_risks' => $this->negative_stock_risks,
            'decision_type' => $this->decision_type,
            'availability_eligibility' => $this->availability_eligibility,
            'recipe_id' => $this->recipe_id,
            'bom_version_number' => $this->bom_version_number,
            'metadata' => $this->metadata,
        ];
    }
}
