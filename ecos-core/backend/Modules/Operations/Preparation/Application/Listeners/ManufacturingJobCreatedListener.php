<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Listeners;

use App\Core\FeatureFlags\FeatureFlagService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Modules\Operations\Preparation\Application\Events\Inbound\ManufacturingJobCreatedEvent;
use Modules\Operations\Preparation\Domain\Enums\ProductionRequirementStatus;
use Throwable;

/**
 * When Manufacturing OS creates a production job in response to our PRP request,
 * store the job_id back on the ProductionRequirement.
 *
 * INTEGRATION-DESIGN.md §13
 */
final class ManufacturingJobCreatedListener
{
    public function __construct(private readonly FeatureFlagService $flags) {}

    public function handle(ManufacturingJobCreatedEvent $event): void
    {
        $companyId = DB::table('preparation_waves')
            ->where('id', $event->requestWaveId)
            ->value('company_id');

        if ($companyId && $this->flags->isDisabled('workflow.stages.preparation', $companyId)) {
            return;
        }

        try {
            DB::table('preparation_production_requirements')
                ->where('preparation_wave_id', $event->requestWaveId)
                ->where('product_id', $event->productId)
                ->update([
                    'manufacturing_job_id' => $event->jobId,
                    'status' => ProductionRequirementStatus::JobCreated->value,
                    'updated_at' => now(),
                ]);
        } catch (Throwable $e) {
            Log::channel('daily')->error('[Preparation] ManufacturingJobCreatedListener failed', [
                'wave_id' => $event->requestWaveId,
                'product_id' => $event->productId,
                'job_id' => $event->jobId,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
