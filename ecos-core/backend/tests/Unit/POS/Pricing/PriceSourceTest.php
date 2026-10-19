<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Pricing;

use Modules\POS\Pricing\Domain\Enums\PriceSource;
use PHPUnit\Framework\TestCase;

final class PriceSourceTest extends TestCase
{
    public function test_all_cases_have_correct_backing_values(): void
    {
        $this->assertSame('regular_price', PriceSource::RegularPrice->value);
        $this->assertSame('sale_price', PriceSource::SalePrice->value);
        $this->assertSame('manual', PriceSource::Manual->value);
    }

    public function test_from_works_for_all_valid_values(): void
    {
        $this->assertSame(PriceSource::RegularPrice, PriceSource::from('regular_price'));
        $this->assertSame(PriceSource::SalePrice, PriceSource::from('sale_price'));
        $this->assertSame(PriceSource::Manual, PriceSource::from('manual'));
    }

    public function test_label_returns_human_readable_string(): void
    {
        $this->assertSame('Regular Price', PriceSource::RegularPrice->label());
        $this->assertSame('Sale Price', PriceSource::SalePrice->label());
        $this->assertSame('Manual Override', PriceSource::Manual->label());
    }

    public function test_is_automatic_for_system_driven_sources(): void
    {
        $this->assertTrue(PriceSource::RegularPrice->isAutomatic());
        $this->assertTrue(PriceSource::SalePrice->isAutomatic());
    }

    public function test_manual_is_not_automatic(): void
    {
        $this->assertFalse(PriceSource::Manual->isAutomatic());
    }
}
