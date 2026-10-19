<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Pricing;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\MasterData\Categories\Domain\Models\Category;
use Modules\MasterData\Units\Domain\Models\Unit;
use Modules\Organization\Brands\Domain\Models\Brand;
use Modules\POS\Pricing\Domain\Enums\PriceSource;
use Modules\POS\Pricing\Domain\Exceptions\PriceResolutionException;
use Modules\POS\Pricing\Domain\ValueObjects\ResolvedPrice;
use Modules\POS\Pricing\Infrastructure\Gateways\ProductPricingGateway;
use Tests\TestCase;

final class ProductPricingGatewayTest extends TestCase
{
    use RefreshDatabase;

    private ProductPricingGateway $gateway;

    private string $categoryId;

    private string $unitId;

    private string $brandId;

    private string $companyId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->gateway = new ProductPricingGateway;

        $category = Category::create([
            'code' => 'TEST-CAT',
            'name' => 'Test Category',
            'level' => 1,
            'sort_order' => 0,
            'is_active' => true,
        ]);

        $unit = Unit::create([
            'code' => 'PCS',
            'name' => 'Piece',
            'is_active' => true,
        ]);

        // products.company_id is NOT NULL. BrandFactory creates its own company,
        // and ProductFactory documents the invariant that a product and its brand
        // must belong to the same company — so both ids are taken from one brand.
        $brand = Brand::factory()->create();
        $this->brandId = (string) $brand->id;
        $this->companyId = (string) $brand->company_id;

        $this->categoryId = (string) $category->id;
        $this->unitId = (string) $unit->id;
    }

    // ── resolvePrice() ────────────────────────────────────────────────────────

    public function test_resolves_sale_price_when_set(): void
    {
        $product = $this->makeProduct(regularPrice: 100.00, salePrice: 79.99);

        $resolved = $this->gateway->resolvePrice((string) $product->id, 'EGP');

        $this->assertInstanceOf(ResolvedPrice::class, $resolved);
        $this->assertSame('79.99', $resolved->unitPrice->amount);
        $this->assertSame('EGP', $resolved->unitPrice->currency);
        $this->assertSame(PriceSource::SalePrice, $resolved->source);
    }

    public function test_falls_back_to_regular_price_when_no_sale_price(): void
    {
        $product = $this->makeProduct(regularPrice: 149.00, salePrice: null);

        $resolved = $this->gateway->resolvePrice((string) $product->id, 'EGP');

        $this->assertSame('149.00', $resolved->unitPrice->amount);
        $this->assertSame(PriceSource::RegularPrice, $resolved->source);
    }

    public function test_falls_back_to_regular_price_when_sale_price_is_zero(): void
    {
        $product = $this->makeProduct(regularPrice: 100.00, salePrice: 0.0);

        $resolved = $this->gateway->resolvePrice((string) $product->id, 'EGP');

        $this->assertSame('100.00', $resolved->unitPrice->amount);
        $this->assertSame(PriceSource::RegularPrice, $resolved->source);
    }

    public function test_resolved_price_product_id_matches(): void
    {
        $product = $this->makeProduct(regularPrice: 50.00);
        $resolved = $this->gateway->resolvePrice((string) $product->id, 'EGP');

        $this->assertSame((string) $product->id, $resolved->productId);
    }

    public function test_resolved_at_is_utc(): void
    {
        $product = $this->makeProduct(regularPrice: 50.00);
        $resolved = $this->gateway->resolvePrice((string) $product->id, 'EGP');

        $this->assertSame('UTC', $resolved->resolvedAt->getTimezone()->getName());
    }

    public function test_throws_product_not_found_for_unknown_id(): void
    {
        $this->expectException(PriceResolutionException::class);
        $this->expectExceptionMessage('not found');

        $this->gateway->resolvePrice('00000000-0000-0000-0000-000000000000', 'EGP');
    }

    public function test_throws_no_price_set_when_both_prices_are_null(): void
    {
        $product = $this->makeProduct(regularPrice: null, salePrice: null);

        $this->expectException(PriceResolutionException::class);
        $this->expectExceptionMessage('no price configured');

        $this->gateway->resolvePrice((string) $product->id, 'EGP');
    }

    public function test_throws_for_inactive_product(): void
    {
        $product = $this->makeProduct(regularPrice: 100.00, active: false);

        $this->expectException(PriceResolutionException::class);
        $this->expectExceptionMessage('inactive');

        $this->gateway->resolvePrice((string) $product->id, 'EGP');
    }

    public function test_currency_is_applied_from_caller(): void
    {
        $product = $this->makeProduct(regularPrice: 50.00);
        $resolved = $this->gateway->resolvePrice((string) $product->id, 'USD');

        $this->assertSame('USD', $resolved->unitPrice->currency);
    }

    // ── resolvePrices() ───────────────────────────────────────────────────────

    public function test_resolve_prices_returns_all_products_keyed_by_id(): void
    {
        $p1 = $this->makeProduct(regularPrice: 10.00);
        $p2 = $this->makeProduct(regularPrice: 20.00, salePrice: 15.00);

        $results = $this->gateway->resolvePrices(
            [(string) $p1->id, (string) $p2->id],
            'EGP',
        );

        $this->assertCount(2, $results);
        $this->assertArrayHasKey((string) $p1->id, $results);
        $this->assertArrayHasKey((string) $p2->id, $results);

        $this->assertSame('10.00', $results[(string) $p1->id]->unitPrice->amount);
        $this->assertSame('15.00', $results[(string) $p2->id]->unitPrice->amount);
        $this->assertSame(PriceSource::SalePrice, $results[(string) $p2->id]->source);
    }

    public function test_resolve_prices_returns_empty_for_empty_input(): void
    {
        $this->assertEmpty($this->gateway->resolvePrices([], 'EGP'));
    }

    public function test_resolve_prices_throws_when_any_product_missing(): void
    {
        $p1 = $this->makeProduct(regularPrice: 10.00);

        $this->expectException(PriceResolutionException::class);

        $this->gateway->resolvePrices(
            [(string) $p1->id, '00000000-0000-0000-0000-000000000000'],
            'EGP',
        );
    }

    public function test_resolve_prices_throws_for_inactive_product_in_batch(): void
    {
        $active = $this->makeProduct(regularPrice: 10.00);
        $inactive = $this->makeProduct(regularPrice: 20.00, active: false);

        $this->expectException(PriceResolutionException::class);

        $this->gateway->resolvePrices(
            [(string) $active->id, (string) $inactive->id],
            'EGP',
        );
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private function makeProduct(
        ?float $regularPrice = null,
        ?float $salePrice = null,
        bool $active = true,
    ): Product {
        static $sku = 0;
        $sku++;

        // Product::factory() rather than Product::create(): company_id is absent
        // from Product::$fillable, so mass assignment silently drops it and the
        // NOT NULL insert fails. Laravel factories build models unguarded, which
        // is why the other 30 factory-using suites were unaffected.
        return Product::factory()->create([
            'sku' => 'TEST-'.str_pad((string) $sku, 4, '0', STR_PAD_LEFT),
            'name' => "Test Product {$sku}",
            'brand_id' => $this->brandId,
            'company_id' => $this->companyId,
            'category_id' => $this->categoryId,
            'unit_id' => $this->unitId,
            'product_type' => Product::TYPE_FINISHED_GOOD,
            'is_active' => $active,
            'regular_price' => $regularPrice,
            'sale_price' => $salePrice,
        ]);
    }
}
