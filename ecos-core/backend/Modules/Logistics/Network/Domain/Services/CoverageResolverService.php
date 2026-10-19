<?php

declare(strict_types=1);

namespace Modules\Logistics\Network\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Logistics\Network\Domain\Enums\CoverageMemberType;
use Modules\Logistics\Network\Domain\Enums\ServiceAreaStatus;
use Modules\Logistics\Network\Domain\Exceptions\NetworkException;
use Modules\Logistics\Network\Domain\Models\CoverageRule;
use Modules\Logistics\Network\Domain\Models\ServiceArea;
use Modules\Logistics\Network\Domain\Models\ServiceAreaMember;

/**
 * Address → service area, and what we can promise there.
 *
 * ┌─ DIRECTIVE 8 — NO DUPLICATE GEOGRAPHY ──────────────────────────────────┐
 * │ Resolution walks the EXISTING hierarchy: a city belongs to a governorate │
 * │ (Geography) and may belong to a distribution zone (LOG-004B). Network    │
 * │ adds membership rows on top and copies nothing.                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Most specific match wins: city > zone > governorate. An explicit exclusion
 * always beats an inclusion, so carving one city out of an included zone works
 * without inventing a second area.
 */
class CoverageResolverService
{
    /**
     * Attach a place to an area, validating that the place exists and is not
     * already claimed by another active area.
     */
    public function attach(
        ServiceArea $area,
        CoverageMemberType $type,
        string $memberId,
        bool $isExcluded = false,
        ?int $actorId = null,
    ): ServiceAreaMember {
        $class = $type->modelClass();

        /** @var class-string<\Illuminate\Database\Eloquent\Model> $class */
        if ($class::query()->find($memberId) === null) {
            throw NetworkException::memberTargetNotFound($type, $memberId);
        }

        $exists = $area->members()
            ->where('member_type', $type->value)
            ->where('member_id', $memberId)
            ->exists();

        if ($exists) {
            throw NetworkException::memberAlreadyAttached($type, $memberId);
        }

        // An inclusion may not overlap another ACTIVE area — otherwise an
        // address resolves to two areas and coverage becomes ambiguous.
        // Exclusions are exempt: carving a place out never creates ambiguity.
        if (! $isExcluded) {
            $conflict = $this->activeAreaClaiming($area->company_id, $type, $memberId, $area->id);

            if ($conflict !== null) {
                throw NetworkException::overlappingCoverage($type, $conflict->name);
            }
        }

        return $area->members()->create([
            'member_type' => $type->value,
            'member_id' => $memberId,
            'is_excluded' => $isExcluded,
            'added_by' => $actorId,
        ]);
    }

    public function detach(ServiceArea $area, int $memberRowId): void
    {
        $area->members()->whereKey($memberRowId)->delete();
    }

    /**
     * Which service area serves this city?
     *
     * Walks city → zone → governorate using the relationships that already
     * exist in V1, then picks the most specific inclusion that is not
     * overridden by an exclusion.
     */
    public function resolveForCity(string $cityId, ?string $companyId = null): ?ServiceArea
    {
        $city = DB::table('logistics_cities')
            ->select(['id', 'governorate_id', 'distribution_zone_id'])
            ->where('id', $cityId)
            ->first();

        if ($city === null) {
            return null;
        }

        // Candidate keys, most specific first.
        $candidates = [
            [CoverageMemberType::City, (string) $city->id],
        ];

        if (! empty($city->distribution_zone_id)) {
            $candidates[] = [CoverageMemberType::Zone, (string) $city->distribution_zone_id];
        }

        if (! empty($city->governorate_id)) {
            $candidates[] = [CoverageMemberType::Governorate, (string) $city->governorate_id];
        }

        $excludedAreaIds = $this->areaIdsExcluding($candidates, $companyId);

        foreach ($candidates as [$type, $id]) {
            $area = ServiceArea::query()
                ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
                ->whereIn('status', [
                    ServiceAreaStatus::Active->value,
                    ServiceAreaStatus::Paused->value,
                ])
                ->whereHas('members', fn ($q) => $q
                    ->where('member_type', $type->value)
                    ->where('member_id', $id)
                    ->where('is_excluded', false))
                ->when($excludedAreaIds !== [], fn ($q) => $q->whereNotIn('id', $excludedAreaIds))
                ->orderByDesc('priority')
                ->first();

            if ($area !== null) {
                return $area;
            }
        }

        return null;
    }

    /**
     * The full coverage answer for a city: the area, its service levels, and
     * the earliest date each can actually serve.
     *
     * A no-coverage result is a normal answer, not an error — Network ADVISES,
     * Orders decides.
     *
     * @return array<string, mixed>
     */
    public function coverageFor(string $cityId, ?string $companyId = null, ?Carbon $at = null): array
    {
        $area = $this->resolveForCity($cityId, $companyId);

        if ($area === null) {
            return [
                'covered' => false,
                'service_area' => null,
                'service_levels' => [],
                'reason' => 'No active service area covers this city.',
            ];
        }

        $at ??= Carbon::now();

        $levels = $area->coverageRules()
            ->where('is_active', true)
            ->with('level')
            ->get()
            ->map(function (CoverageRule $rule) use ($at) {
                $earliest = $rule->earliestServiceDate($at);

                return [
                    'service_level_id' => $rule->level?->uuid,
                    'code' => $rule->level?->code,
                    'name' => $rule->level?->name,
                    'cutoff_time' => $rule->cutoff_time,
                    'lead_time_hours' => $rule->lead_time_hours,
                    'past_cutoff' => $rule->isPastCutoff($at),
                    'surcharge' => $rule->surcharge !== null ? (float) $rule->surcharge : null,
                    'currency' => $rule->currency,
                    // Null means this level serves no day inside the horizon —
                    // a misconfiguration worth surfacing, not hiding.
                    'earliest_service_date' => $earliest?->toDateString(),
                ];
            })
            ->values()
            ->all();

        return [
            'covered' => true,
            'service_area' => [
                'id' => $area->uuid,
                'code' => $area->code,
                'name' => $area->name,
                'status' => $area->status->value,
                'accepts_commitments' => $area->acceptsCommitments(),
                'dispatch_region_id' => $area->region?->uuid,
            ],
            'service_levels' => $levels,
            'reason' => null,
        ];
    }

    /**
     * Areas that explicitly EXCLUDE one of these keys. An exclusion always
     * beats an inclusion, so these areas are removed from consideration before
     * the inclusion search runs.
     *
     * @param  list<array{0: CoverageMemberType, 1: string}>  $candidates
     * @return list<int>
     */
    private function areaIdsExcluding(array $candidates, ?string $companyId): array
    {
        $query = ServiceAreaMember::query()
            ->where('is_excluded', true)
            ->where(function ($q) use ($candidates) {
                foreach ($candidates as [$type, $id]) {
                    $q->orWhere(fn ($inner) => $inner
                        ->where('member_type', $type->value)
                        ->where('member_id', $id));
                }
            });

        if ($companyId !== null) {
            $query->whereHas('area', fn ($q) => $q->where('company_id', $companyId));
        }

        return $query->pluck('service_area_id')->unique()->values()->all();
    }

    private function activeAreaClaiming(
        ?string $companyId,
        CoverageMemberType $type,
        string $memberId,
        int $excludeAreaId,
    ): ?ServiceArea {
        return ServiceArea::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->where('id', '!=', $excludeAreaId)
            ->where('status', ServiceAreaStatus::Active->value)
            ->whereHas('members', fn ($q) => $q
                ->where('member_type', $type->value)
                ->where('member_id', $memberId)
                ->where('is_excluded', false))
            ->first();
    }
}
