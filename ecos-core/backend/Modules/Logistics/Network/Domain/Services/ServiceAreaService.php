<?php

declare(strict_types=1);

namespace Modules\Logistics\Network\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Logistics\Network\Domain\Enums\ServiceAreaStatus;
use Modules\Logistics\Network\Domain\Events\ServiceAreaClosed;
use Modules\Logistics\Network\Domain\Events\ServiceAreaOpened;
use Modules\Logistics\Network\Domain\Exceptions\NetworkException;
use Modules\Logistics\Network\Domain\Models\ServiceArea;

/** Service-area lifecycle. */
class ServiceAreaService
{
    /** @param array<string, mixed> $attributes */
    public function create(array $attributes): ServiceArea
    {
        return DB::transaction(fn () => ServiceArea::create($attributes));
    }

    public function changeStatus(
        ServiceArea $area,
        ServiceAreaStatus $target,
        ?string $reason = null,
        ?string $actor = null,
    ): ServiceArea {
        $current = $area->status;

        if ($current === $target) {
            return $area;
        }

        if (! $current->canTransitionTo($target)) {
            throw NetworkException::invalidAreaTransition($current, $target);
        }

        // An area with no members covers nothing. Activating one would create a
        // region that silently never matches an address.
        if ($target === ServiceAreaStatus::Active && ! $area->hasCoverage()) {
            throw NetworkException::areaHasNoCoverage();
        }

        $updated = DB::transaction(function () use ($area, $target, $reason) {
            $area->update([
                'status' => $target->value,
                'status_reason' => $reason,
            ]);

            return $area->refresh();
        });

        if ($target === ServiceAreaStatus::Active) {
            ServiceAreaOpened::dispatch($updated, $actor);
        }

        if ($target === ServiceAreaStatus::Closed) {
            ServiceAreaClosed::dispatch($updated, $actor);
        }

        return $updated;
    }
}
