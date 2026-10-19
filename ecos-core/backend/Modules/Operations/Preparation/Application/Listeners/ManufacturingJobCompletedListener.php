<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Listeners;

use App\Core\FeatureFlags\FeatureFlagService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Modules\Operations\Preparation\Application\Events\Inbound\ManufacturingJobCompletedEvent;
use Modules\Operations\Preparation\Domain\Enums\ProductionRequirementStatus;
use Throwable;

/**
 * When Manufacturing OS completes a production job,
 * update the linked ProductionRequirement status → ready.
 *
 * INTEGRATION-DESIGN.md §13
 */
final class ManufacturingJobCompletedListener
{
    public function __construct(private readonly FeatureFlagService $flags) {}

    public function handle(ManufacturingJobCompletedEvent $event): void
    {
        $companyId = DB::table('preparation_production_requirements')
            ->where('manufacturing_job_id', $event->jobId)
            ->value('company_id');

        if ($companyId && $this->flags->isDisabled('workflow.stages.preparation', $companyId)) {
            return;
        }

        try {
            DB::table('preparation_production_requirements')
                ->where('manufacturing_job_id', $event->jobId)
                ->update([
                    'status' => ProductionRequirementStatus::Ready->value,
                    'quantity_produced' => $event->quantityProduced,
                    'updated_at' => now(),
                ]);
        } catch (Throwable $e) {
            Log::channel('daily')->error('[Preparation] ManufacturingJobCompletedListener failed', [
                'job_id' => $event->jobId,
                'product_id' => $event->productId,
                'qty_produced' => $event->quantityProduced,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
