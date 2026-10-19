<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseMaterials\Application\Actions;

use Modules\Core\DemandAnalysis\Application\Services\DemandAnalysisService;
use Modules\Purchasing\PurchaseMaterials\Domain\Services\PurchaseMaterialRuleEngine;

/**
 * Thin adapter that returns the backwards-compatible procurement-panel shape
 * while delegating all computation to the shared DemandAnalysisService.
 */
final class GetProductProcurementPanelAction
{
    public function __construct(
        private readonly DemandAnalysisService $demandService,
        private readonly PurchaseMaterialRuleEngine $ruleEngine,
    ) {}

    public function execute(string $productId, ?string $warehouseId = null, float $requestedQty = 0, ?string $requiredDate = null): array
    {
        $dto = $this->demandService->analyze($productId, $warehouseId);

        $panel = $dto->toProcurementPanel();

        // Override recommendations with procurement-specific rule engine output
        if ($requestedQty > 0) {
            $panel['recommendations'] = $this->ruleEngine->evaluate($panel, $requestedQty, $requiredDate);
        }

        return $panel;
    }
}
