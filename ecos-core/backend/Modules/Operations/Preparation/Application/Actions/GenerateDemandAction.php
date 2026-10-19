<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Actions;

use App\Core\Audit\AuditService;
use App\Core\FeatureFlags\FeatureFlagService;
use App\Core\Timeline\TimelineService;
use Illuminate\Support\Facades\DB;
use Modules\Operations\Preparation\Domain\Enums\WaveItemStatus;
use Modules\Operations\Preparation\Domain\Enums\WaveStatus;
use Modules\Operations\Preparation\Domain\Exceptions\InvalidWaveStatusTransitionException;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use Modules\Operations\Preparation\Domain\Models\PreparationWaveItem;

final class GenerateDemandAction
{
    public function __construct(
        private readonly AuditService $audit,
        private readonly TimelineService $timeline,
        private readonly FeatureFlagService $flags,
    ) {}

    public function execute(PreparationWave $wave, string $actorId): PreparationWave
    {
        $this->guardWorkflowStage($wave->company_id);

        if ($wave->status !== WaveStatus::Draft) {
            throw InvalidWaveStatusTransitionException::from($wave->status, WaveStatus::Planning);
        }

        return DB::transaction(function () use ($wave, $actorId): PreparationWave {
            $wave->waveItems()->delete();

            $rows = DB::table('order_lines as ol')
                ->join('products as p', 'p.id', '=', 'ol.product_id')
                ->join(
                    'preparation_wave_orders as pwo',
                    fn ($j) => $j->on('pwo.order_id', '=', 'ol.order_id')
                        ->where('pwo.preparation_wave_id', '=', $wave->id),
                )
                ->selectRaw('
                    ol.product_id,
                    p.sku,
                    p.name,
                    SUM(ol.quantity) AS total_qty,
                    COUNT(DISTINCT ol.order_id) AS order_count
                ')
                ->groupBy('ol.product_id', 'p.sku', 'p.name')
                ->get();

            $linesCount = DB::table('order_lines as ol')
                ->join(
                    'preparation_wave_orders as pwo',
                    fn ($j) => $j->on('pwo.order_id', '=', 'ol.order_id')
                        ->where('pwo.preparation_wave_id', '=', $wave->id),
                )
                ->count();

            $totalRequired = 0.0;
            $now = now()->toIso8601String();

            foreach ($rows as $row) {
                $qty = (float) $row->total_qty;
                $totalRequired += $qty;

                PreparationWaveItem::create([
                    'company_id' => $wave->company_id,
                    'preparation_wave_id' => $wave->id,
                    'product_id' => $row->product_id,
                    'sku_snapshot' => $row->sku,
                    'name_snapshot' => $row->name,
                    'quantity_required' => $qty,
                    'quantity_prepared' => 0,
                    'quantity_short' => 0,
                    'status' => WaveItemStatus::Pending->value,
                    'created_by' => $actorId,
                    'updated_by' => $actorId,
                ]);
            }

            $wave->update([
                'status' => WaveStatus::Planning->value,
                'products_count' => $rows->count(),
                'lines_count' => $linesCount,
                'total_units_required' => $totalRequired,
                'updated_by' => $actorId,
            ]);

            $this->timeline->record(
                companyId: $wave->company_id,
                subjectType: 'PreparationWave',
                subjectId: $wave->id,
                eventType: 'wave.demand_generated',
                title: "Demand generated for wave {$wave->wave_number}",
                description: $rows->count().' product(s), '.$totalRequired.' total units',
                actorId: (int) $actorId,
                sourceModule: 'Operations.Preparation',
            );

            $this->audit->record(
                action: 'preparation.wave.demand_generated',
                entityType: 'PreparationWave',
                entityId: $wave->id,
                companyId: $wave->company_id,
                userId: (int) $actorId,
                newValues: ['status' => WaveStatus::Planning->value, 'products_count' => $rows->count()],
            );

            return $wave->fresh(['waveItems']) ?? $wave;
        });
    }

    private function guardWorkflowStage(string $companyId): void
    {
        if ($this->flags->isDisabled('workflow.stages.preparation', $companyId)) {
            abort(503, 'Preparation stage is not enabled in the active fulfillment profile.');
        }
    }
}
