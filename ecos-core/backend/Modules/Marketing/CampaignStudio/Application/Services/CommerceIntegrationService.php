<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Application\Services;

use Illuminate\Support\Facades\DB;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignDraft;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignProduct;

class CommerceIntegrationService
{
    public function linkProduct(CampaignDraft $draft, array $data): CampaignProduct
    {
        return CampaignProduct::updateOrCreate(
            [
                'campaign_draft_id' => $draft->id,
                'product_type' => $data['product_type'],
                'product_id' => $data['product_id'],
            ],
            array_merge($data, [
                'campaign_draft_id' => $draft->id,
                'last_checked_at' => now(),
            ]),
        );
    }

    public function unlinkProduct(CampaignDraft $draft, string $productId): void
    {
        CampaignProduct::where('campaign_draft_id', $draft->id)->findOrFail($productId)->delete();
    }

    public function refreshAvailability(CampaignDraft $draft): array
    {
        $products = CampaignProduct::where('campaign_draft_id', $draft->id)->get();
        $warnings = [];

        foreach ($products as $product) {
            $availability = $this->checkAvailability($product->product_type, $product->product_id);

            $product->update([
                'availability_status' => $availability['status'],
                'quantity_available' => $availability['quantity'],
                'last_checked_at' => now(),
            ]);

            if ($product->warn_if_unavailable && $availability['status'] !== 'available') {
                $warnings[] = [
                    'product_id' => $product->product_id,
                    'product_name' => $product->product_name,
                    'status' => $availability['status'],
                    'quantity' => $availability['quantity'],
                ];
            }
        }

        return [
            'products_checked' => $products->count(),
            'warnings' => $warnings,
            'has_issues' => count($warnings) > 0,
        ];
    }

    private function checkAvailability(string $productType, string $productId): array
    {
        // Query the appropriate inventory table based on product_type
        $status = 'available';
        $quantity = null;

        if ($productType === 'finished_good') {
            $product = DB::table('products')->where('id', $productId)->first();
            if (! $product) {
                return ['status' => 'discontinued', 'quantity' => 0];
            }

            $stock = DB::table('inventory_movements')
                ->where('product_id', $productId)
                ->selectRaw('SUM(quantity) as total')
                ->value('total') ?? 0;

            $quantity = (int) $stock;

            if ($quantity <= 0) {
                $status = 'out_of_stock';
            } elseif ($quantity < 10) {
                $status = 'low_stock';
            }
        }

        return ['status' => $status, 'quantity' => $quantity];
    }
}
