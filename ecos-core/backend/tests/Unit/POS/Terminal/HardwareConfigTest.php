<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Terminal;

use InvalidArgumentException;
use Modules\POS\Terminal\Domain\ValueObjects\HardwareConfig;
use PHPUnit\Framework\TestCase;

/**
 * PKG-POS-003: HardwareConfig value object unit tests.
 * Pure unit tests — no database, no Laravel boot.
 */
final class HardwareConfigTest extends TestCase
{
    // -------------------------------------------------------------------------
    // Factories
    // -------------------------------------------------------------------------

    public function test_default_config_has_thermal_80mm_printer(): void
    {
        $config = HardwareConfig::default();

        $this->assertSame('thermal_80mm', $config->printerType);
        $this->assertTrue($config->cashDrawerEnabled);
        $this->assertTrue($config->barcodeScannerEnabled);
        $this->assertFalse($config->customerDisplayEnabled);
        $this->assertNull($config->halAgentUrlOverride);
    }

    public function test_minimal_config_has_no_hardware(): void
    {
        $config = HardwareConfig::minimal();

        $this->assertSame('none', $config->printerType);
        $this->assertFalse($config->cashDrawerEnabled);
        $this->assertFalse($config->barcodeScannerEnabled);
        $this->assertFalse($config->customerDisplayEnabled);
        $this->assertNull($config->halAgentUrlOverride);
    }

    // -------------------------------------------------------------------------
    // Validation
    // -------------------------------------------------------------------------

    public function test_rejects_unknown_printer_type(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Unknown printer type "laser"');

        new HardwareConfig(
            printerType: 'laser',
            cashDrawerEnabled: false,
            barcodeScannerEnabled: false,
            customerDisplayEnabled: false,
            halAgentUrlOverride: null,
        );
    }

    public function test_accepts_all_valid_printer_types(): void
    {
        foreach (['thermal_80mm', 'thermal_58mm', 'a4', 'none'] as $type) {
            $config = new HardwareConfig($type, false, false, false, null);
            $this->assertSame($type, $config->printerType);
        }
    }

    // -------------------------------------------------------------------------
    // Serialisation round-trip
    // -------------------------------------------------------------------------

    public function test_to_array_contains_all_fields(): void
    {
        $config = HardwareConfig::default();
        $array = $config->toArray();

        $this->assertArrayHasKey('printer_type', $array);
        $this->assertArrayHasKey('cash_drawer_enabled', $array);
        $this->assertArrayHasKey('barcode_scanner_enabled', $array);
        $this->assertArrayHasKey('customer_display_enabled', $array);
        $this->assertArrayHasKey('hal_agent_url_override', $array);
    }

    public function test_from_array_round_trip(): void
    {
        $original = new HardwareConfig(
            printerType: 'thermal_58mm',
            cashDrawerEnabled: true,
            barcodeScannerEnabled: false,
            customerDisplayEnabled: true,
            halAgentUrlOverride: 'ws://pos-agent:8765',
        );

        $restored = HardwareConfig::fromArray($original->toArray());

        $this->assertTrue($original->equals($restored));
    }

    public function test_from_array_with_missing_keys_uses_safe_defaults(): void
    {
        $config = HardwareConfig::fromArray([]);

        $this->assertSame('none', $config->printerType);
        $this->assertFalse($config->cashDrawerEnabled);
        $this->assertFalse($config->barcodeScannerEnabled);
        $this->assertFalse($config->customerDisplayEnabled);
        $this->assertNull($config->halAgentUrlOverride);
    }

    public function test_from_array_preserves_hal_agent_url(): void
    {
        $config = HardwareConfig::fromArray(['hal_agent_url_override' => 'ws://custom:9000']);

        $this->assertSame('ws://custom:9000', $config->halAgentUrlOverride);
    }

    // -------------------------------------------------------------------------
    // Domain helpers
    // -------------------------------------------------------------------------

    public function test_has_printer_true_for_non_none(): void
    {
        $this->assertTrue(HardwareConfig::default()->hasPrinter());
    }

    public function test_has_printer_false_for_none(): void
    {
        $this->assertFalse(HardwareConfig::minimal()->hasPrinter());
    }

    // -------------------------------------------------------------------------
    // Immutable mutations (with*)
    // -------------------------------------------------------------------------

    public function test_with_printer_type_returns_new_instance(): void
    {
        $original = HardwareConfig::default();
        $updated = $original->withPrinterType('thermal_58mm');

        $this->assertSame('thermal_80mm', $original->printerType, 'original unchanged');
        $this->assertSame('thermal_58mm', $updated->printerType);
        $this->assertTrue($updated->cashDrawerEnabled, 'other fields preserved');
    }

    public function test_with_printer_type_validates_type(): void
    {
        $this->expectException(InvalidArgumentException::class);

        HardwareConfig::default()->withPrinterType('inkjet');
    }

    public function test_with_agent_url_returns_new_instance(): void
    {
        $original = HardwareConfig::default();
        $updated = $original->withAgentUrl('ws://other:1234');

        $this->assertNull($original->halAgentUrlOverride, 'original unchanged');
        $this->assertSame('ws://other:1234', $updated->halAgentUrlOverride);
    }

    public function test_with_agent_url_null_clears_override(): void
    {
        $config = HardwareConfig::default()->withAgentUrl('ws://x:1');
        $cleared = $config->withAgentUrl(null);

        $this->assertNull($cleared->halAgentUrlOverride);
    }

    // -------------------------------------------------------------------------
    // Equality
    // -------------------------------------------------------------------------

    public function test_equals_same_config(): void
    {
        $a = HardwareConfig::default();
        $b = HardwareConfig::default();

        $this->assertTrue($a->equals($b));
    }

    public function test_not_equals_different_printer_type(): void
    {
        $a = HardwareConfig::default();
        $b = $a->withPrinterType('a4');

        $this->assertFalse($a->equals($b));
    }
}
