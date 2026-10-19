<?php

declare(strict_types=1);

namespace Modules\Marketing\Intelligence\Application\Dto;

use Carbon\Carbon;
use Illuminate\Http\Request;

/**
 * Immutable filter value object shared by all Intelligence controllers and services.
 *
 * Every controller constructs one via fromRequest(), passes it to MarketingKpiEngine,
 * and the engine is responsible for applying the filters to the appropriate queries.
 */
final class IntelligenceFilterDto
{
    public function __construct(
        public readonly ?string $companyId = null,
        public readonly ?string $connectionId = null,
        public readonly ?string $adAccountId = null, // external_account_id on campaigns
        public readonly ?string $campaignId = null,
        public readonly ?string $adSetId = null,
        public readonly string $datePreset = 'last_30d',
        public readonly ?string $dateStart = null,
        public readonly ?string $dateStop = null,
        public readonly ?string $status = null, // campaign status filter
    ) {}

    public static function fromRequest(Request $request): self
    {
        // company_id is always taken from the authenticated user — never from
        // the query string — to prevent cross-company IDOR data access.
        return new self(
            companyId: (string) $request->user()->company_id,
            connectionId: $request->query('connection_id'),
            adAccountId: $request->query('ad_account_id'),
            campaignId: $request->query('campaign_id'),
            adSetId: $request->query('ad_set_id'),
            datePreset: $request->query('date_preset', 'last_30d'),
            dateStart: $request->query('date_start'),
            dateStop: $request->query('date_stop'),
            status: $request->query('status'),
        );
    }

    /**
     * Resolved [start, end] dates as 'Y-m-d' strings.
     *
     * @return array{0: string, 1: string}
     */
    public function resolvedDates(): array
    {
        if ($this->dateStart !== null && $this->dateStop !== null) {
            return [$this->dateStart, $this->dateStop];
        }

        $today = now()->toDateString();

        return match ($this->datePreset) {
            'today' => [$today, $today],
            'yesterday' => [now()->subDay()->toDateString(), now()->subDay()->toDateString()],
            'last_7d' => [now()->subDays(7)->toDateString(), $today],
            'last_30d' => [now()->subDays(30)->toDateString(), $today],
            'last_90d' => [now()->subDays(90)->toDateString(), $today],
            'last_180d' => [now()->subDays(180)->toDateString(), $today],
            'this_month' => [now()->startOfMonth()->toDateString(), $today],
            'last_month' => [
                now()->subMonth()->startOfMonth()->toDateString(),
                now()->subMonth()->endOfMonth()->toDateString(),
            ],
            default => [now()->subDays(30)->toDateString(), $today],
        };
    }

    /**
     * Number of days in the current period (for growth comparison sizing).
     */
    public function periodDays(): int
    {
        [$start, $end] = $this->resolvedDates();

        return (int) Carbon::parse($start)->diffInDays(Carbon::parse($end)) + 1;
    }

    /**
     * Returns a DTO scoped to the immediately preceding period of equal length.
     * Used for growth calculations (e.g. last 30d vs prior 30d).
     */
    public function previousPeriodFilter(): self
    {
        [$start] = $this->resolvedDates();
        $days = $this->periodDays();

        $prevEnd = Carbon::parse($start)->subDay()->toDateString();
        $prevStart = Carbon::parse($prevEnd)->subDays($days - 1)->toDateString();

        return new self(
            companyId: $this->companyId,
            connectionId: $this->connectionId,
            adAccountId: $this->adAccountId,
            campaignId: $this->campaignId,
            adSetId: $this->adSetId,
            dateStart: $prevStart,
            dateStop: $prevEnd,
            status: $this->status,
        );
    }

    /**
     * Deterministic cache key for this filter combination.
     */
    public function cacheKey(string $prefix = 'mkt_intel'): string
    {
        return $prefix.':'.md5((string) json_encode([
            $this->companyId,
            $this->connectionId,
            $this->adAccountId,
            $this->campaignId,
            $this->adSetId,
            $this->datePreset,
            $this->dateStart,
            $this->dateStop,
            $this->status,
        ]));
    }

    /** Return a copy scoped to a specific campaign. */
    public function withCampaignId(string $campaignId): self
    {
        return new self(
            companyId: $this->companyId,
            connectionId: $this->connectionId,
            adAccountId: $this->adAccountId,
            campaignId: $campaignId,
            datePreset: $this->datePreset,
            dateStart: $this->dateStart,
            dateStop: $this->dateStop,
            status: $this->status,
        );
    }

    /** Return a copy scoped to a specific ad set. */
    public function withAdSetId(string $adSetId): self
    {
        return new self(
            companyId: $this->companyId,
            connectionId: $this->connectionId,
            adAccountId: $this->adAccountId,
            campaignId: $this->campaignId,
            adSetId: $adSetId,
            datePreset: $this->datePreset,
            dateStart: $this->dateStart,
            dateStop: $this->dateStop,
            status: $this->status,
        );
    }
}
