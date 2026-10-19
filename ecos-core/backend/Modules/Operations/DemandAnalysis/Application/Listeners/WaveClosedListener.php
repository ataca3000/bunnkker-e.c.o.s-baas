<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Application\Listeners;

use Modules\Operations\Preparation\Domain\Events\WaveClosed;

/**
 * Wave closure: read models are intentionally KEPT for historical reference.
 * The UI can still display the final demand snapshot of a closed wave.
 *
 * No recalculation is triggered — a closed wave does not accept new orders.
 */
final class WaveClosedListener
{
    public function handle(WaveClosed $event): void
    {
        // Deliberate no-op: demand projections are preserved as historical record.
        // If future requirements need archival/compression, add it here.
    }
}
