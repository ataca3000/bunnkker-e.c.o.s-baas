<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Actions;

use App\Core\Audit\AuditService;
use App\Core\FeatureFlags\FeatureFlagService;
use App\Core\Timeline\TimelineService;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Modules\Operations\Preparation\Application\Notifications\ShortageDetectedNotification;
use Modules\Operations\Preparation\Domain\Enums\WaveStatus;
use Modules\Operations\Preparation\Domain\Events\ShortageDetected;
use Modules\Operations\Preparation\Domain\Exceptions\InvalidWaveStatusTransitionException;
use Modules\Operations\Preparation\Domain\Models\PreparationMaterialRequirement;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

final class AnalyzeMaterialsAction
{
    public function __construct(
        private readonly AuditService $audit,
        private readonly TimelineService $timeline,
        private readonly FeatureFlagService $flags,
    ) {}

    public function execute(PreparationWave $wave, string $actorId): PreparationWave
    {
        $this->guardWorkflowStage($wave->company_id);

        if ($wave->status !== WaveStatus::Planning) {
            throw InvalidWaveStatusTransitionException::from($wave->status, WaveStatus::Planning);
        }

        return DB::transaction(function () use ($wave, $actorId): PreparationWave {
            $wave->materialRequirements()->delete();

            $items = $wave->waveItems()->get();
            $shortages = [];
            $shortageDetected = false;
            $now = now();

            foreach ($items as $item) {
                $recipe = DB::table('bill_of_material_lines as bl')
                    ->join('bill_of_materials as bom', function ($j) use ($item) {
                        $j->on('bom.id', '=', 'bl.bill_of_material_id')
                            ->where('bom.product_id', '=', $item->product_id)
                            ->where('bom.is_active', '=', true);
                    })
                    ->join('products as rm', 'rm.id', '=', 'bl.raw_material_id')
                    ->select(
                        'bl.raw_material_id',
                        'rm.name as material_name',
                        'rm.sku as material_unit',
                        'bl.quantity_per_unit',
                        'bl.waste_factor',
                    )
                    ->get();

                foreach ($recipe as $line) {
                    $required = $item->quantity_required
                        * (float) $line->quantity_per_unit
                        * (1 + ((float) ($line->waste_factor ?? 0)));

                    $available = (float) DB::table('inventory_items')
                        ->where('product_id', $line->raw_material_id)
                        ->where('company_id', $wave->company_id)
                        ->sum('on_hand_qty');

                    $shortage = $available < $required;
                    $shortageAmount = $shortage ? max(0, $required - $available) : 0;

                    if ($shortage) {
                        $shortageDetected = true;
                        $shortages[] = [
                            'raw_material_id' => $line->raw_material_id,
                            'material_name' => $line->material_name,
                            'unit' => $line->material_unit,
                            'quantity_required' => $required,
                            'quantity_available' => $available,
                            'shortage_amount' => $shortageAmount,
                            'quantity_to_purchase' => $shortageAmount,
                        ];
                    }

                    $existing = PreparationMaterialRequirement::where('preparation_wave_id', $wave->id)
                        ->where('raw_material_id', $line->raw_material_id)
                        ->first();

                    if ($existing) {
                        $existing->update([
                            'quantity_required' => $existing->quantity_required + $required,
                            'shortage' => ($existing->quantity_available < ($existing->quantity_required + $required)),
                            'shortage_amount' => max(0, ($existing->quantity_required + $required) - $existing->quantity_available),
                            'quantity_to_purchase' => max(0, ($existing->quantity_required + $required) - $existing->quantity_available),
                            'updated_by' => $actorId,
                        ]);
                    } else {
                        PreparationMaterialRequirement::create([
                            'company_id' => $wave->company_id,
                            'preparation_wave_id' => $wave->id,
                            'raw_material_id' => $line->raw_material_id,
                            'material_name_snapshot' => $line->material_name,
                            'unit_snapshot' => $line->material_unit,
                            'quantity_required' => $required,
                            'quantity_available' => $available,
                            'quantity_to_purchase' => $shortageAmount,
                            'shortage' => $shortage,
                            'shortage_amount' => $shortageAmount,
                            'analyzed_at' => $now,
                            'analyzed_by' => $actorId,
                            'created_by' => $actorId,
                            'updated_by' => $actorId,
                        ]);
                    }
                }
            }

            $newStatus = $shortageDetected
                ? WaveStatus::ShortageBlocked->value
                : WaveStatus::Planning->value;

            $wave->update([
                'status' => $newStatus,
                'shortage_detected' => $shortageDetected,
                'updated_by' => $actorId,
            ]);

            if ($shortageDetected) {
                event(new ShortageDetected(
                    waveId: $wave->id,
                    waveNumber: $wave->wave_number,
                    companyId: $wave->company_id,
                    warehouseId: $wave->warehouse_id,
                    planningDate: $wave->planning_date->toDateString(),
                    shortages: $shortages,
                ));

                $actor = User::find($actorId);
                if ($actor) {
                    $actor->notify(new ShortageDetectedNotification(
                        $wave->wave_number,
                        $wave->id,
                        $shortages,
                    ));
                }
            }

            $this->timeline->record(
                companyId: $wave->company_id,
                subjectType: 'PreparationWave',
                subjectId: $wave->id,
                eventType: $shortageDetected ? 'wave.shortage_detected' : 'wave.materials_analyzed',
                title: $shortageDetected
                    ? "Shortage detected on wave {$wave->wave_number} — ".count($shortages).' material(s)'
                    : "Materials analysis complete for wave {$wave->wave_number}",
                actorId: (int) $actorId,
                sourceModule: 'Operations.Preparation',
            );

            $this->audit->record(
                action: 'preparation.wave.materials_analyzed',
                entityType: 'PreparationWave',
                entityId: $wave->id,
                companyId: $wave->company_id,
                userId: (int) $actorId,
                newValues: ['status' => $newStatus, 'shortage_detected' => $shortageDetected, 'shortages_count' => count($shortages)],
            );

            return $wave->fresh(['materialRequirements']) ?? $wave;
        });
    }

    private function guardWorkflowStage(string $companyId): void
    {
        if ($this->flags->isDisabled('workflow.stages.preparation', $companyId)) {
            abort(503, 'Preparation stage is not enabled in the active fulfillment profile.');
        }
    }
}
