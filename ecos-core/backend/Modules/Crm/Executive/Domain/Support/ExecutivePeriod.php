<?php

declare(strict_types=1);

namespace Modules\Crm\Executive\Domain\Support;

use Illuminate\Support\Carbon;
use Modules\Crm\Executive\Domain\Enums\ReportPeriod;

/**
 * An immutable reporting window, plus the window it is compared against.
 *
 * Every executive metric is scoped by one of these. Period boundaries are derived
 * from the calendar (not stored), so a month, quarter or year always means the
 * same thing and a report re-run for the same period returns the same window.
 */
final class ExecutivePeriod
{
    private function __construct(
        public readonly ReportPeriod $type,
        public readonly Carbon $start,
        public readonly Carbon $end,
        public readonly string $label,
    ) {}

    public static function monthly(int $year, int $month): self
    {
        $start = Carbon::create($year, $month, 1)->startOfMonth();

        return new self(ReportPeriod::Monthly, $start->copy(), $start->copy()->endOfMonth(), $start->format('F Y'));
    }

    public static function quarterly(int $year, int $quarter): self
    {
        $quarter = max(1, min(4, $quarter));
        $start = Carbon::create($year, (($quarter - 1) * 3) + 1, 1)->startOfMonth();

        return new self(ReportPeriod::Quarterly, $start->copy(), $start->copy()->addMonths(2)->endOfMonth(), "Q{$quarter} {$year}");
    }

    public static function annual(int $year): self
    {
        $start = Carbon::create($year, 1, 1)->startOfYear();

        return new self(ReportPeriod::Annual, $start->copy(), $start->copy()->endOfYear(), (string) $year);
    }

    public static function custom(Carbon $start, Carbon $end): self
    {
        $from = $start->copy()->startOfDay();
        $to = $end->copy()->endOfDay();

        return new self(ReportPeriod::Custom, $from, $to, $from->toDateString().' → '.$to->toDateString());
    }

    /** The current calendar month — the default executive view. */
    public static function currentMonth(): self
    {
        $now = Carbon::now();

        return self::monthly((int) $now->year, (int) $now->month);
    }

    /** The equivalent preceding window, for period-over-period comparison. */
    public function previous(): self
    {
        return match ($this->type) {
            ReportPeriod::Monthly => self::monthlyOf($this->start->copy()->subMonthNoOverflow()),
            ReportPeriod::Quarterly => $this->previousQuarter(),
            ReportPeriod::Annual => self::annual((int) $this->start->year - 1),
            ReportPeriod::Custom => $this->previousCustom(),
        };
    }

    /**
     * The buckets a growth trend is charted over — weeks inside a month, months
     * inside a quarter or year. Bounded by MAX_TREND_BUCKETS so the query count
     * stays predictable no matter how long the window is.
     *
     * @return array<int, array{label: string, start: Carbon, end: Carbon}>
     */
    public function buckets(): array
    {
        return match ($this->type) {
            ReportPeriod::Monthly => $this->weekBuckets(),
            ReportPeriod::Quarterly, ReportPeriod::Annual => $this->monthBuckets(),
            ReportPeriod::Custom => $this->evenBuckets(),
        };
    }

    public function days(): int
    {
        return max(1, (int) floor((float) $this->start->diffInDays($this->end)) + 1);
    }

    /** @return array<string, string> */
    public function toArray(): array
    {
        return [
            'type' => $this->type->value,
            'label' => $this->label,
            'start' => $this->start->toDateTimeString(),
            'end' => $this->end->toDateTimeString(),
        ];
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private static function monthlyOf(Carbon $moment): self
    {
        return self::monthly((int) $moment->year, (int) $moment->month);
    }

    private function previousQuarter(): self
    {
        $quarter = (int) ceil((int) $this->start->month / 3);
        $year = (int) $this->start->year;

        return $quarter === 1 ? self::quarterly($year - 1, 4) : self::quarterly($year, $quarter - 1);
    }

    private function previousCustom(): self
    {
        $length = $this->days();
        $end = $this->start->copy()->subDay()->endOfDay();

        return self::custom($end->copy()->subDays($length - 1), $end);
    }

    /** @return array<int, array{label: string, start: Carbon, end: Carbon}> */
    private function weekBuckets(): array
    {
        $buckets = [];
        $cursor = $this->start->copy();
        $index = 1;

        while ($cursor->lessThanOrEqualTo($this->end) && count($buckets) < ExecutiveThresholds::MAX_TREND_BUCKETS) {
            $end = $cursor->copy()->addDays(6)->endOfDay();
            if ($end->greaterThan($this->end)) {
                $end = $this->end->copy();
            }

            $buckets[] = ['label' => 'W'.$index, 'start' => $cursor->copy(), 'end' => $end];
            $cursor = $end->copy()->addSecond()->startOfDay();
            $index++;
        }

        return $buckets;
    }

    /** @return array<int, array{label: string, start: Carbon, end: Carbon}> */
    private function monthBuckets(): array
    {
        $buckets = [];
        $cursor = $this->start->copy()->startOfMonth();

        while ($cursor->lessThanOrEqualTo($this->end) && count($buckets) < ExecutiveThresholds::MAX_TREND_BUCKETS) {
            $end = $cursor->copy()->endOfMonth();
            if ($end->greaterThan($this->end)) {
                $end = $this->end->copy();
            }

            $buckets[] = ['label' => $cursor->format('M Y'), 'start' => $cursor->copy(), 'end' => $end];
            $cursor = $cursor->copy()->addMonthNoOverflow()->startOfMonth();
        }

        return $buckets;
    }

    /** @return array<int, array{label: string, start: Carbon, end: Carbon}> */
    private function evenBuckets(): array
    {
        $totalDays = $this->days();
        $count = (int) min(ExecutiveThresholds::MAX_TREND_BUCKETS, max(1, $totalDays));
        $size = (int) max(1, (int) ceil($totalDays / $count));

        $buckets = [];
        $cursor = $this->start->copy();
        $index = 1;

        while ($cursor->lessThanOrEqualTo($this->end) && count($buckets) < ExecutiveThresholds::MAX_TREND_BUCKETS) {
            $end = $cursor->copy()->addDays($size - 1)->endOfDay();
            if ($end->greaterThan($this->end)) {
                $end = $this->end->copy();
            }

            $buckets[] = ['label' => 'P'.$index, 'start' => $cursor->copy(), 'end' => $end];
            $cursor = $end->copy()->addSecond()->startOfDay();
            $index++;
        }

        return $buckets;
    }
}
