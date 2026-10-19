<?php

declare(strict_types=1);

namespace Modules\POS\Terminal\Domain\ValueObjects;

use InvalidArgumentException;

use function in_array;

/**
 * Immutable configuration of a terminal's physical hardware.
 *
 * Stored as JSONB in `pos_terminals.hardware_config`.
 * Decoded via HardwareConfig::fromArray(); serialised via toArray().
 *
 * HAL deployment note (ADR-POS-003):
 *   - In-browser tier: WebHID / Web Serial for supported devices.
 *   - Local agent tier: WebSocket agent at `halAgentUrlOverride` (falls back
 *     to `pos.hal.agent_ws_url` config if null).
 */
final readonly class HardwareConfig
{
    /** Allowed printer type identifiers. */
    private const PRINTER_TYPES = ['thermal_80mm', 'thermal_58mm', 'a4', 'none'];

    public function __construct(
        public string $printerType,
        public bool $cashDrawerEnabled,
        public bool $barcodeScannerEnabled,
        public bool $customerDisplayEnabled,
        public ?string $halAgentUrlOverride,
    ) {
        if (! in_array($this->printerType, self::PRINTER_TYPES, strict: true)) {
            throw new InvalidArgumentException(
                "Unknown printer type \"{$this->printerType}\". "
                .'Allowed: '.implode(', ', self::PRINTER_TYPES).'.',
            );
        }
    }

    /** Standard retail counter configuration. */
    public static function default(): self
    {
        return new self(
            printerType: 'thermal_80mm',
            cashDrawerEnabled: true,
            barcodeScannerEnabled: true,
            customerDisplayEnabled: false,
            halAgentUrlOverride: null,
        );
    }

    /** Minimal configuration — no hardware attached. */
    public static function minimal(): self
    {
        return new self(
            printerType: 'none',
            cashDrawerEnabled: false,
            barcodeScannerEnabled: false,
            customerDisplayEnabled: false,
            halAgentUrlOverride: null,
        );
    }

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        return new self(
            printerType: (string) ($data['printer_type'] ?? 'none'),
            cashDrawerEnabled: (bool) ($data['cash_drawer_enabled'] ?? false),
            barcodeScannerEnabled: (bool) ($data['barcode_scanner_enabled'] ?? false),
            customerDisplayEnabled: (bool) ($data['customer_display_enabled'] ?? false),
            halAgentUrlOverride: isset($data['hal_agent_url_override'])
                                      ? (string) $data['hal_agent_url_override']
                                      : null,
        );
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'printer_type' => $this->printerType,
            'cash_drawer_enabled' => $this->cashDrawerEnabled,
            'barcode_scanner_enabled' => $this->barcodeScannerEnabled,
            'customer_display_enabled' => $this->customerDisplayEnabled,
            'hal_agent_url_override' => $this->halAgentUrlOverride,
        ];
    }

    public function hasPrinter(): bool
    {
        return $this->printerType !== 'none';
    }

    /** Produces a new instance with the printer type changed. */
    public function withPrinterType(string $printerType): self
    {
        return new self(
            printerType: $printerType,
            cashDrawerEnabled: $this->cashDrawerEnabled,
            barcodeScannerEnabled: $this->barcodeScannerEnabled,
            customerDisplayEnabled: $this->customerDisplayEnabled,
            halAgentUrlOverride: $this->halAgentUrlOverride,
        );
    }

    /** Produces a new instance with the agent URL override changed. */
    public function withAgentUrl(?string $url): self
    {
        return new self(
            printerType: $this->printerType,
            cashDrawerEnabled: $this->cashDrawerEnabled,
            barcodeScannerEnabled: $this->barcodeScannerEnabled,
            customerDisplayEnabled: $this->customerDisplayEnabled,
            halAgentUrlOverride: $url,
        );
    }

    public function equals(self $other): bool
    {
        return $this->toArray() === $other->toArray();
    }
}
