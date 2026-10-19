<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Actions;

use Illuminate\Support\Facades\DB;
use Modules\Operations\Preparation\Domain\Models\PreparationSession;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use RuntimeException;

final class AddWaveToSessionAction
{
    public function execute(PreparationSession $session, PreparationWave $wave, string $actorId): PreparationSession
    {
        if ($wave->company_id !== $session->company_id) {
            throw new RuntimeException('Wave belongs to a different company.');
        }

        if ($wave->preparation_session_id !== null && $wave->preparation_session_id !== $session->id) {
            throw new RuntimeException('Wave is already assigned to a different session.');
        }

        return DB::transaction(function () use ($session, $wave, $actorId): PreparationSession {
            $wave->update([
                'preparation_session_id' => $session->id,
                'updated_by' => $actorId,
            ]);

            // Recalculate session denormalized counts from its waves.
            $agg = PreparationWave::where('preparation_session_id', $session->id)
                ->selectRaw('COUNT(*) as waves_count, SUM(products_count) as products_count, SUM(total_units_required) as total_units_required, SUM(total_units_prepared) as total_units_prepared')
                ->first();

            $session->update([
                'waves_count' => $agg->waves_count ?? 0,
                'products_count' => $agg->products_count ?? 0,
                'total_units_required' => $agg->total_units_required ?? 0,
                'total_units_prepared' => $agg->total_units_prepared ?? 0,
                'updated_by' => $actorId,
            ]);

            return $session->refresh();
        });
    }
}
