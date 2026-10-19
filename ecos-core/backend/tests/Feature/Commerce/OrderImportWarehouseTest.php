<?php

declare(strict_types=1);

namespace Tests\Feature\Commerce;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\OrderImport\Application\Services\WooCommerceOrderImporter;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Brands\Domain\Models\Brand;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

class OrderImportWarehouseTest extends TestCase
{
    use RefreshDatabase;

    private Company $company;

    private Brand $brand;

    private Warehouse $warehouse;

    private Channel $channel;

    protected function setUp(): void
    {
        parent::setUp();
        $this->company = Company::factory()->create();
        $this->brand = Brand::factory()->create(['company_id' => $this->company->id]);
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);
        $this->channel = Channel::factory()->create([
            'brand_id' => $this->brand->id,
        ]);
    }

    private function makeWooOrder(string $sku, int $wooId = 1001): array
    {
        return [
            'id' => $wooId,
            'number' => (string) $wooId,
            'status' => 'processing',
            'date_created' => '2026-06-25T10:00:00',
            'customer_note' => '',
            'total' => '100.00',
            'shipping_total' => '0',
            'discount_total' => '0',
            'total_tax' => '0',
            'billing' => [
                'first_name' => 'Ahmed',
                'last_name' => 'Ali',
                'email' => 'ahmed@example.com',
                'phone' => '01012345678',
                'country' => 'EG',
                'city' => 'Cairo',
                'address_1' => '1 Tahrir Square',
                'company' => '',
                'state' => '',
                'address_2' => '',
                'postcode' => '',
            ],
            'shipping' => [],
            'shipping_lines' => [],
            'payment_method' => 'bacs',
            'payment_method_title' => 'Direct bank transfer',
            'transaction_id' => '',
            'date_paid' => '',
            'line_items' => [
                [
                    'product_id' => 99,
                    'sku' => $sku,
                    'name' => 'Test Product',
                    'quantity' => 2,
                    'price' => '50.00',
                    'subtotal' => '100.00',
                    'total' => '100.00',
                ],
            ],
            'fee_lines' => [],
            'coupon_lines' => [],
            'tax_lines' => [],
        ];
    }

    /**
     * ADR-015: Warehouse assignment happens at allocation time, not at import.
     * Imported orders always start with assigned_warehouse_id = null.
     */
    public function test_imported_order_has_null_warehouse_assignment(): void
    {
        $product = Product::factory()->create(['sku' => 'SKU-WH-001']);

        $importer = app(WooCommerceOrderImporter::class);
        $imported = $importer->importSingle($this->channel, $this->makeWooOrder('SKU-WH-001'));

        $this->assertTrue($imported);

        $order = Order::query()->where('external_order_id', '1001')->firstOrFail();
        $this->assertNull($order->assigned_warehouse_id);
    }

    public function test_assigned_warehouse_null_when_channel_has_no_default(): void
    {
        $channelWithoutWarehouse = Channel::factory()->create([
            'brand_id' => $this->brand->id,
        ]);

        $product = Product::factory()->create(['sku' => 'SKU-WH-002']);

        $importer = app(WooCommerceOrderImporter::class);
        $imported = $importer->importSingle($channelWithoutWarehouse, $this->makeWooOrder('SKU-WH-002', wooId: 1002));

        $this->assertTrue($imported);

        $order = Order::query()->where('external_order_id', '1002')->firstOrFail();
        $this->assertNull($order->assigned_warehouse_id);
    }

    /** Regression: channel is owned by brand, not directly by company. */
    public function test_channel_ownership_is_brand_not_company(): void
    {
        $channel = Channel::factory()->create(['brand_id' => $this->brand->id]);

        $this->assertNotNull($channel->brand_id);
        $this->assertSame($this->brand->id, $channel->brand_id);

        // Company is resolved indirectly — not a direct column on channels
        $channel->load('brand.company');
        $this->assertSame($this->company->id, $channel->brand?->company?->id);
        $this->assertFalse(isset($channel->company_id));
    }

    /** Regression: creating a channel with company_id in payload must be rejected by validation. */
    public function test_store_channel_rejects_payload_without_brand_id(): void
    {
        $user = \App\Models\User::factory()->create();

        $this->actingAs($user)
            ->postJson('/api/channels', [
                'name' => 'Test Channel',
                'platform' => 'woocommerce',
                'store_url' => 'https://example.com',
                'is_active' => true,
                // Missing brand_id — must fail validation
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['brand_id']);
    }
}
