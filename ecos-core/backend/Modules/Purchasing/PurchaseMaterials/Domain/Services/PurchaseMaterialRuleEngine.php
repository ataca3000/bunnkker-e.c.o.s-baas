<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseMaterials\Domain\Services;

/**
 * Rule-based procurement recommendations engine.
 * No AI — deterministic rules only.
 *
 * Input:  panel data (from GetProductProcurementPanelAction) + requested_qty
 * Output: list of recommendation objects with type, severity, message
 */
final class PurchaseMaterialRuleEngine
{
    public const SEVERITY_INFO = 'info';

    public const SEVERITY_WARNING = 'warning';

    public const SEVERITY_ERROR = 'error';

    /**
     * @param  array  $panel  Output of GetProductProcurementPanelAction::execute()
     * @param  float  $requestedQty  Quantity being requested
     * @param  string|null  $requiredDate  ISO date string or null
     * @return list<array{type: string, severity: string, message: string, recommended_qty: float|null}>
     */
    public function evaluate(array $panel, float $requestedQty, ?string $requiredDate = null): array
    {
        $recommendations = [];

        $daily = (float) ($panel['consumption']['daily_avg'] ?? 0);
        $monthly = (float) ($panel['consumption']['monthly_avg'] ?? 0);
        $available = (float) ($panel['inventory']['available_qty'] ?? 0);
        $days = $panel['coverage']['days_remaining'] ?? null;
        $lastPrice = $panel['last_purchase']['last_price'] ?? null;

        // Rule 1: Coverage is sufficient
        if ($days !== null && $days > 30 && $daily > 0) {
            $recommendations[] = [
                'type' => 'coverage_sufficient',
                'severity' => self::SEVERITY_INFO,
                'message' => sprintf(
                    'Current stock covers approximately %.0f days. Consider whether this request is needed now.',
                    $days,
                ),
                'recommended_qty' => null,
            ];
        }

        // Rule 2: Quantity above 60-day demand
        if ($daily > 0 && $requestedQty > $daily * 60) {
            $recommendations[] = [
                'type' => 'quantity_above_demand',
                'severity' => self::SEVERITY_WARNING,
                'message' => sprintf(
                    'Requested quantity (%.2f) exceeds 60 days of average demand (%.2f). Consider reducing.',
                    $requestedQty,
                    $daily * 60,
                ),
                'recommended_qty' => round($monthly * 1.5, 2),
            ];
        }

        // Rule 3: Overstock risk — after receiving, stock covers more than 90 days
        if ($daily > 0 && ($available + $requestedQty) > ($daily * 90)) {
            $recommendations[] = [
                'type' => 'overstock_risk',
                'severity' => self::SEVERITY_WARNING,
                'message' => sprintf(
                    'After receiving, total stock would cover approximately %.0f days. Overstock risk.',
                    ($available + $requestedQty) / $daily,
                ),
                'recommended_qty' => max(0, round($daily * 30 - $available, 2)),
            ];
        }

        // Rule 4: Recommended quantity (default — based on 30-day consumption + safety buffer)
        if ($daily > 0 && count($recommendations) === 0) {
            $recommended = round($monthly * 1.2, 2); // 20% safety buffer
            if (abs($requestedQty - $recommended) / max($recommended, 1) > 0.2) {
                $recommendations[] = [
                    'type' => 'recommended_quantity',
                    'severity' => self::SEVERITY_INFO,
                    'message' => sprintf(
                        'Recommended quantity based on 30-day average + 20%% safety buffer: %.2f.',
                        $recommended,
                    ),
                    'recommended_qty' => $recommended,
                ];
            }
        }

        // Rule 5: Lead time risk — required_date is too soon for supplier lead time
        if ($requiredDate !== null) {
            $altSuppliers = $panel['alternative_suppliers'] ?? [];
            $minLeadTime = null;
            foreach ($altSuppliers as $s) {
                $lt = $s['lead_time_days'] ?? null;
                if ($lt !== null && ($minLeadTime === null || $lt < $minLeadTime)) {
                    $minLeadTime = $lt;
                }
            }
            if ($minLeadTime !== null) {
                $daysUntilRequired = (int) ceil(
                    (strtotime($requiredDate) - time()) / 86400,
                );
                if ($daysUntilRequired < $minLeadTime) {
                    $recommendations[] = [
                        'type' => 'lead_time_risk',
                        'severity' => self::SEVERITY_ERROR,
                        'message' => sprintf(
                            'Required date is in %d day(s), but shortest supplier lead time is %d day(s). Expedited order may be needed.',
                            $daysUntilRequired,
                            $minLeadTime,
                        ),
                        'recommended_qty' => null,
                    ];
                }
            }
        }

        // Rule 6: Better supplier available (last price comparison)
        if ($lastPrice !== null && $lastPrice > 0) {
            $altSuppliers = $panel['alternative_suppliers'] ?? [];
            foreach ($altSuppliers as $s) {
                $altPrice = $s['last_price'] ?? null;
                if ($altPrice !== null && $altPrice < $lastPrice * 0.95) {
                    $recommendations[] = [
                        'type' => 'better_supplier',
                        'severity' => self::SEVERITY_INFO,
                        'message' => sprintf(
                            '%s offers a lower price (%.2f vs %.2f last paid) — a saving of ~%.1f%%.',
                            $s['supplier_name'],
                            $altPrice,
                            $lastPrice,
                            (1 - $altPrice / $lastPrice) * 100,
                        ),
                        'recommended_qty' => null,
                    ];
                    break;
                }
            }
        }

        // Rule 7: Critical stock — coverage below 3 days
        if ($days !== null && $days <= 3 && $daily > 0) {
            $recommendations[] = [
                'type' => 'critical_stock',
                'severity' => self::SEVERITY_ERROR,
                'message' => sprintf(
                    'Critical: only %.1f day(s) of stock remaining. Mark as Urgent.',
                    $days,
                ),
                'recommended_qty' => null,
            ];
        }

        return $recommendations;
    }
}
