<?php

declare(strict_types=1);

namespace Tests\Unit\Operations\DemandEngine;

use Modules\Operations\DemandAnalysis\Domain\Enums\MaterialPriority;
use Tests\TestCase;

/**
 * Pure unit test — no DB required.
 */
class MaterialPriorityEnumTest extends TestCase
{
    public function test_critical_at_81_percent(): void
    {
        $p = MaterialPriority::fromShortageRatio(8.1, 10.0);
        $this->assertSame(MaterialPriority::Critical, $p);
    }

    public function test_critical_at_100_percent(): void
    {
        $p = MaterialPriority::fromShortageRatio(10.0, 10.0);
        $this->assertSame(MaterialPriority::Critical, $p);
    }

    public function test_high_at_51_percent(): void
    {
        $p = MaterialPriority::fromShortageRatio(5.1, 10.0);
        $this->assertSame(MaterialPriority::High, $p);
    }

    public function test_high_at_exactly_80_percent(): void
    {
        $p = MaterialPriority::fromShortageRatio(8.0, 10.0);
        $this->assertSame(MaterialPriority::High, $p);
    }

    public function test_medium_at_21_percent(): void
    {
        $p = MaterialPriority::fromShortageRatio(2.1, 10.0);
        $this->assertSame(MaterialPriority::Medium, $p);
    }

    public function test_low_at_exactly_20_percent(): void
    {
        $p = MaterialPriority::fromShortageRatio(2.0, 10.0);
        $this->assertSame(MaterialPriority::Low, $p);
    }

    public function test_low_at_zero_shortage(): void
    {
        $p = MaterialPriority::fromShortageRatio(0.0, 10.0);
        $this->assertSame(MaterialPriority::Low, $p);
    }

    public function test_low_when_required_is_zero(): void
    {
        $p = MaterialPriority::fromShortageRatio(0.0, 0.0);
        $this->assertSame(MaterialPriority::Low, $p);
    }

    public function test_enum_values(): void
    {
        $this->assertSame('critical', MaterialPriority::Critical->value);
        $this->assertSame('high', MaterialPriority::High->value);
        $this->assertSame('medium', MaterialPriority::Medium->value);
        $this->assertSame('low', MaterialPriority::Low->value);
    }
}
