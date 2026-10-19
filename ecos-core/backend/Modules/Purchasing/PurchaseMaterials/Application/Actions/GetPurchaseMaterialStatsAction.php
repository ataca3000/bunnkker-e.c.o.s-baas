<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseMaterials\Application\Actions;

use Illuminate\Support\Facades\DB;
use Modules\Purchasing\PurchaseMaterials\Domain\Models\PurchaseMaterial;

final class GetPurchaseMaterialStatsAction
{
    public function execute(?string $companyId = null, ?string $warehouseId = null): array
    {
        $query = PurchaseMaterial::query();

        if ($companyId !== null && $companyId !== '') {
            $query->where('company_id', $companyId);
        }
        if ($warehouseId !== null && $warehouseId !== '') {
            $query->where('warehouse_id', $warehouseId);
        }

        // Status counts
        $byCounts = (clone $query)
            ->select('status', DB::raw('COUNT(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        // Financial totals
        $financials = (clone $query)
            ->selectRaw(
                'COALESCE(SUM(estimated_value), 0) as total_estimated,
                 COALESCE(SUM(CASE WHEN status IN (\'approved\', \'purchasing\', \'receiving\', \'completed\') THEN approved_value ELSE 0 END), 0) as total_approved,
                 COALESCE(SUM(CASE WHEN status IN (\'purchasing\', \'receiving\', \'completed\') THEN purchased_value ELSE 0 END), 0) as total_purchased',
            )
            ->first();

        // Priority counts
        $byPriority = (clone $query)
            ->select('priority', DB::raw('COUNT(*) as count'))
            ->groupBy('priority')
            ->pluck('count', 'priority')
            ->toArray();

        $totalApproved = (float) ($financials?->total_approved ?? 0);
        $totalPurchased = (float) ($financials?->total_purchased ?? 0);

        return [
            'operational' => [
                'draft' => (int) ($byCounts['draft'] ?? 0),
                'under_review' => (int) ($byCounts['under_review'] ?? 0),
                'waiting_supplier_selection' => (int) ($byCounts['waiting_supplier_selection'] ?? 0),
                'approved' => (int) ($byCounts['approved'] ?? 0),
                'purchasing' => (int) ($byCounts['purchasing'] ?? 0),
                'receiving' => (int) ($byCounts['receiving'] ?? 0),
            ],
            'financial' => [
                'total_estimated_value' => (float) ($financials?->total_estimated ?? 0),
                'total_approved_value' => $totalApproved,
                'total_purchased_value' => $totalPurchased,
                'outstanding_value' => max(0.0, $totalApproved - $totalPurchased),
            ],
            'by_priority' => [
                'urgent' => (int) ($byPriority['urgent'] ?? 0),
                'high' => (int) ($byPriority['high'] ?? 0),
                'normal' => (int) ($byPriority['normal'] ?? 0),
                'low' => (int) ($byPriority['low'] ?? 0),
            ],
        ];
    }
}
