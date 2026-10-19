<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Receipt;

use Modules\POS\Receipt\Domain\Enums\ReprintReason;
use Modules\POS\Receipt\Domain\ValueObjects\ReprintRecord;
use PHPUnit\Framework\TestCase;

final class ReprintRecordTest extends TestCase
{
    private function makeRecord(ReprintReason $reason = ReprintReason::CustomerRequest): ReprintRecord
    {
        return ReprintRecord::of('cashier-1', 'term-1', $reason);
    }

    public function test_generates_unique_reprint_ids(): void
    {
        $r1 = $this->makeRecord();
        $r2 = $this->makeRecord();

        $this->assertNotSame($r1->reprintId, $r2->reprintId);
    }

    public function test_reprint_id_is_valid_uuid(): void
    {
        $record = $this->makeRecord();

        $this->assertMatchesRegularExpression(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/',
            $record->reprintId,
        );
    }

    public function test_stores_cashier_and_terminal(): void
    {
        $record = $this->makeRecord();

        $this->assertSame('cashier-1', $record->cashierId);
        $this->assertSame('term-1', $record->terminalId);
    }

    public function test_stores_reason_as_value(): void
    {
        $record = ReprintRecord::of('cashier-1', 'term-1', ReprintReason::PrinterError);

        $this->assertSame('printer_error', $record->reason);
    }

    public function test_reprinted_at_is_iso_format(): void
    {
        $record = $this->makeRecord();

        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T/', $record->reprintedAt);
    }

    public function test_to_array_has_expected_keys(): void
    {
        $array = $this->makeRecord()->toArray();

        $this->assertArrayHasKey('reprint_id', $array);
        $this->assertArrayHasKey('cashier_id', $array);
        $this->assertArrayHasKey('terminal_id', $array);
        $this->assertArrayHasKey('reprinted_at', $array);
        $this->assertArrayHasKey('reason', $array);
    }

    public function test_round_trips_via_array(): void
    {
        $original = $this->makeRecord();
        $restored = ReprintRecord::fromArray($original->toArray());

        $this->assertSame($original->reprintId, $restored->reprintId);
        $this->assertSame($original->cashierId, $restored->cashierId);
        $this->assertSame($original->terminalId, $restored->terminalId);
        $this->assertSame($original->reprintedAt, $restored->reprintedAt);
        $this->assertSame($original->reason, $restored->reason);
    }
}
