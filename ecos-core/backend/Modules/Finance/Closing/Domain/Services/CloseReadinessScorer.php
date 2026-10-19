<?php

declare(strict_types=1);

namespace Modules\Finance\Closing\Domain\Services;

use Modules\Finance\Closing\Domain\Enums\CheckStatus;

/**
 * Computes a 0–100 close-readiness score from a checklist. Blocking checks weigh
 * more than advisory ones; skipped checks are excluded. 100 means every check
 * that matters has passed — the period is ready to close.
 */
final class CloseReadinessScorer
{
    /** @param list<array<string, mixed>> $checks */
    public function compute(array $checks): float
    {
        $totalWeight = 0.0;
        $passedWeight = 0.0;

        foreach ($checks as $check) {
            /** @var CheckStatus $status */
            $status = $check['status'];
            if ($status === CheckStatus::Skipped) {
                continue;
            }

            $weight = ($check['is_blocking'] ?? true) ? 3.0 : 1.0;
            $totalWeight += $weight;
            if ($status === CheckStatus::Passed) {
                $passedWeight += $weight;
            }
        }

        if ($totalWeight === 0.0) {
            return 100.0;
        }

        return round($passedWeight / $totalWeight * 100, 2);
    }
}
