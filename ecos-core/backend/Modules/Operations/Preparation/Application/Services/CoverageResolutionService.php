<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Services;

use Illuminate\Support\Collection;
use Modules\Admin\Configuration\Domain\Models\MasterGovernorate;
use Modules\Admin\Configuration\Domain\Models\MasterZone;
use Modules\Organization\Branches\Domain\Models\BranchCoverageArea;

/**
 * TASK-BRANCH-ASSIGNMENT-ENGINE-001 — Coverage Resolution Service.
 *
 * Given a delivery governorate name and optional zone/area name, returns the set
 * of active BranchCoverageArea records that cover that location — ordered from
 * most-specific (zone-level) to least-specific (governorate-wide).
 *
 * Matching strategy:
 *   1. Resolve governorate → find master_governorate by name (case-insensitive)
 *   2. Resolve zone        → find master_zone by name within that governorate (if provided)
 *   3. Return coverage rows where:
 *      a. master_governorate_id matches AND master_zone_id = resolved zone  (zone-level match)
 *      b. master_governorate_id matches AND master_zone_id IS NULL            (governorate-wide)
 *   4. Zone-level rows are preferred; governorate-wide rows are fallback.
 */
final class CoverageResolutionService
{
    /**
     * Resolve active coverage areas for the given location.
     *
     * @param  string      $governorate  Free-text governorate name from the order
     * @param  string|null $zone         Free-text zone / area name (optional)
     * @return Collection<int, BranchCoverageArea>  Ordered: zone-specific first, then governorate-wide
     */
    public function resolve(string $governorate, ?string $zone): Collection
    {
        $masterGovernorate = MasterGovernorate::whereRaw('LOWER(name) = LOWER(?)', [trim($governorate)])
            ->where('is_active', true)
            ->first();

        if ($masterGovernorate === null) {
            return collect();
        }

        $masterZoneId = null;
        if ($zone !== null && $zone !== '') {
            $masterZoneId = MasterZone::whereRaw('LOWER(name) = LOWER(?)', [trim($zone)])
                ->where('master_governorate_id', $masterGovernorate->id)
                ->where('is_active', true)
                ->value('id');
        }

        // Load ALL active coverage areas for this governorate (both zone-specific and wide).
        $candidates = BranchCoverageArea::where('master_governorate_id', $masterGovernorate->id)
            ->where('is_active', true)
            ->with('branch')
            ->get();

        if ($candidates->isEmpty()) {
            return collect();
        }

        // Separate zone-level from governorate-wide.
        $zoneMatches = $masterZoneId !== null
            ? $candidates->filter(fn (BranchCoverageArea $c) => $c->master_zone_id === $masterZoneId)
            : collect();

        $governorateWide = $candidates->filter(fn (BranchCoverageArea $c) => $c->master_zone_id === null);

        // Zone-specific results take absolute priority. Return those if available; otherwise
        // fall back to governorate-wide. This prevents "city branch" from competing with
        // "governorate branch" for the same order — most-specific always wins.
        $result = $zoneMatches->isNotEmpty() ? $zoneMatches : $governorateWide;

        // Within the selected tier, sort by priority ASC (lower number = higher priority).
        return $result->sortBy('priority')->values();
    }
}
