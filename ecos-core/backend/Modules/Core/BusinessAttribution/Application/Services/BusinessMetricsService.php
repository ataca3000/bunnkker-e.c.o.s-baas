<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Application\Services;

use Carbon\Carbon;
use Illuminate\Support\Str;
use Modules\Core\BusinessAttribution\Domain\Enums\JourneyStage;
use Modules\Core\BusinessAttribution\Domain\Models\BusinessDna;
use Modules\Core\BusinessAttribution\Domain\Models\BusinessMetric;
use Modules\Core\BusinessAttribution\Domain\Models\JourneyStep;

/**
 * Business Metrics Engine — auto-calculates journey durations after each step.
 */
final class BusinessMetricsService
{
    /**
     * Recalculate all journey metrics for a DNA record.
     * Called automatically after RecordJourneyStepAction.
     */
    public function recalculate(BusinessDna $dna): BusinessMetric
    {
        $steps = JourneyStep::where('business_dna_id', $dna->id)
            ->orderBy('occurred_at')
            ->get();

        $stageMap = $steps->mapWithKeys(static fn (JourneyStep $s) => [
            $s->journey_stage instanceof JourneyStage
                ? $s->journey_stage->value
                : (string) $s->journey_stage => $s->occurred_at instanceof Carbon
                ? $s->occurred_at
                : Carbon::parse($s->occurred_at),
        ]);

        $diff = static function (string $from, string $to) use ($stageMap): ?int {
            if ($stageMap->has($from) && $stageMap->has($to)) {
                return (int) abs($stageMap[$to]->diffInSeconds($stageMap[$from]));
            }

            return null;
        };

        $firstAt = $stageMap->first();
        $lastAt = $stageMap->last();

        $data = [
            'time_to_first_contact_s' => $diff(JourneyStage::Lead->value, JourneyStage::Conversation->value),
            'lead_to_quote_s' => $diff(JourneyStage::Lead->value, JourneyStage::Quote->value),
            'quote_to_order_s' => $diff(JourneyStage::Quote->value, JourneyStage::Order->value),
            'order_to_payment_s' => $diff(JourneyStage::Order->value, JourneyStage::Payment->value),
            'payment_to_preparation_s' => $diff(JourneyStage::Payment->value, JourneyStage::Preparation->value),
            'preparation_to_packing_s' => $diff(JourneyStage::Preparation->value, JourneyStage::Packing->value),
            'packing_to_shipment_s' => $diff(JourneyStage::Packing->value, JourneyStage::Shipment->value),
            'shipment_to_delivery_s' => $diff(JourneyStage::Shipment->value, JourneyStage::Delivery->value),
            'delivery_to_repeat_s' => $diff(JourneyStage::Delivery->value, JourneyStage::RepeatPurchase->value),
            'customer_lifetime_duration_s' => $diff(JourneyStage::Lead->value, JourneyStage::VipCustomer->value),
            'total_journey_time_s' => ($firstAt && $lastAt) ? (int) abs($lastAt->diffInSeconds($firstAt)) : null,
            'calculated_at' => Carbon::now(),
        ];

        /** @var BusinessMetric $metric */
        $metric = BusinessMetric::updateOrCreate(
            ['business_dna_id' => $dna->id],
            array_merge(['id' => Str::uuid()->toString()], $data),
        );

        return $metric;
    }

    /**
     * Aggregate average metrics across all journeys for a company.
     *
     * @return array<string, float|null>
     */
    public function aggregateAverages(?string $companyId = null): array
    {
        $query = BusinessMetric::query()
            ->join('bae_business_dna', 'bae_business_metrics.business_dna_id', '=', 'bae_business_dna.id');

        if ($companyId) {
            $query->where('bae_business_dna.company_id', $companyId);
        }

        $row = $query->selectRaw('
            AVG(time_to_first_contact_s)      AS avg_time_to_first_contact_s,
            AVG(lead_to_quote_s)              AS avg_lead_to_quote_s,
            AVG(quote_to_order_s)             AS avg_quote_to_order_s,
            AVG(order_to_payment_s)           AS avg_order_to_payment_s,
            AVG(preparation_to_packing_s)     AS avg_preparation_to_packing_s,
            AVG(packing_to_shipment_s)        AS avg_packing_to_shipment_s,
            AVG(shipment_to_delivery_s)       AS avg_shipment_to_delivery_s,
            AVG(total_journey_time_s)         AS avg_total_journey_time_s
        ')->first();

        if (! $row) {
            return [];
        }

        return array_map(static fn ($v) => $v !== null ? round((float) $v, 2) : null, $row->toArray());
    }
}
