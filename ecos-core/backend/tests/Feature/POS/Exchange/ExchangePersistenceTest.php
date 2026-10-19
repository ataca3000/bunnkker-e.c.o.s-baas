<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Exchange;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\POS\Exchange\Domain\Enums\ExchangeReason;
use Modules\POS\Exchange\Domain\Enums\ExchangeStatus;
use Modules\POS\Exchange\Domain\Exceptions\ExchangeNotFoundException;
use Modules\POS\Exchange\Domain\Models\Exchange;
use Modules\POS\Exchange\Domain\ValueObjects\ExchangeLine;
use Modules\POS\Exchange\Infrastructure\Repositories\EloquentExchangeRepository;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Quantity;
use Tests\TestCase;

final class ExchangePersistenceTest extends TestCase
{
    use RefreshDatabase;

    private EloquentExchangeRepository $repo;

    protected function setUp(): void
    {
        parent::setUp();

        $this->repo = new EloquentExchangeRepository;
    }

    // ── save / findById ───────────────────────────────────────────────────────

    public function test_saves_and_retrieves_by_id(): void
    {
        $exchange = $this->makeExchange('EXC-PERSIST-001');
        $this->repo->save($exchange);

        $found = $this->repo->findById((string) $exchange->id);

        $this->assertSame((string) $exchange->id, (string) $found->id);
        $this->assertSame('EXC-PERSIST-001', $found->exchange_number);
    }

    public function test_find_by_id_throws_for_unknown_id(): void
    {
        $this->expectException(ExchangeNotFoundException::class);

        $this->repo->findById('00000000-0000-0000-0000-000000000000');
    }

    // ── findByNumber ──────────────────────────────────────────────────────────

    public function test_find_by_number_retrieves_correct_exchange(): void
    {
        $exchange = $this->makeExchange('EXC-NUMBER-001');
        $this->repo->save($exchange);

        $found = $this->repo->findByNumber('EXC-NUMBER-001');

        $this->assertSame('EXC-NUMBER-001', $found->exchange_number);
    }

    public function test_find_by_number_throws_for_unknown_number(): void
    {
        $this->expectException(ExchangeNotFoundException::class);

        $this->repo->findByNumber('EXC-DOES-NOT-EXIST');
    }

    // ── findBySaleId ──────────────────────────────────────────────────────────

    public function test_find_by_sale_id_returns_all_exchanges_for_sale(): void
    {
        $this->repo->save($this->makeExchange('EXC-SALE-001', saleId: 'sale-99'));
        $this->repo->save($this->makeExchange('EXC-SALE-002', saleId: 'sale-99'));
        $this->repo->save($this->makeExchange('EXC-SALE-003', saleId: 'sale-other'));

        $results = $this->repo->findBySaleId('sale-99');

        $this->assertCount(2, $results);
    }

    public function test_find_by_sale_id_returns_empty_array_when_none_found(): void
    {
        $this->assertEmpty($this->repo->findBySaleId('sale-nonexistent'));
    }

    // ── JSON round-trips ──────────────────────────────────────────────────────

    public function test_returned_lines_persist_and_reload_correctly(): void
    {
        $exchange = $this->makeExchange('EXC-JSON-001');
        $this->repo->save($exchange);

        $found = $this->repo->findById((string) $exchange->id);
        $lines = $found->getReturnedLines();

        $this->assertCount(1, $lines);
        $this->assertSame('line-01', $lines[0]->originalLineId);
        $this->assertSame('prod-1', $lines[0]->productId);
        $this->assertSame('Blue Shirt S', $lines[0]->productName);
        $this->assertSame('100.00', $lines[0]->unitPrice->amount);
        $this->assertSame('EGP', $lines[0]->unitPrice->currency);
    }

    public function test_replacement_lines_persist_and_reload_correctly(): void
    {
        $exchange = $this->makeExchange('EXC-JSON-002');
        $this->repo->save($exchange);

        $found = $this->repo->findById((string) $exchange->id);
        $lines = $found->getReplacementLines();

        $this->assertCount(1, $lines);
        $this->assertNull($lines[0]->originalLineId);
        $this->assertSame('prod-1', $lines[0]->productId);
        $this->assertSame('Blue Shirt M', $lines[0]->productName);
    }

    public function test_returned_total_persists_correctly(): void
    {
        $exchange = $this->makeExchange('EXC-TOT-001');
        $this->repo->save($exchange);

        $found = $this->repo->findById((string) $exchange->id);

        $this->assertSame('100.00', $found->getReturnedTotal()->amount);
        $this->assertSame('EGP', $found->getReturnedTotal()->currency);
    }

    public function test_replacement_total_persists_correctly(): void
    {
        $exchange = $this->makeExchange('EXC-TOT-002', replacementPrice: '120.00');
        $this->repo->save($exchange);

        $found = $this->repo->findById((string) $exchange->id);

        $this->assertSame('120.00', $found->getReplacementTotal()->amount);
    }

    // ── status transitions persist ────────────────────────────────────────────

    public function test_confirm_status_persists(): void
    {
        $exchange = $this->makeExchange('EXC-STATUS-001');
        $exchange->confirm();
        $this->repo->save($exchange);

        $found = $this->repo->findById((string) $exchange->id);

        $this->assertSame(ExchangeStatus::Confirmed, $found->getStatus());
        $this->assertNotNull($found->confirmed_at);
    }

    public function test_complete_status_persists(): void
    {
        $exchange = $this->makeExchange('EXC-STATUS-002');
        $exchange->confirm();
        $exchange->complete();
        $this->repo->save($exchange);

        $found = $this->repo->findById((string) $exchange->id);

        $this->assertSame(ExchangeStatus::Completed, $found->getStatus());
        $this->assertNotNull($found->completed_at);
    }

    public function test_cancel_status_persists_with_reason(): void
    {
        $exchange = $this->makeExchange('EXC-STATUS-003');
        $exchange->cancel('Out of stock for replacement');
        $this->repo->save($exchange);

        $found = $this->repo->findById((string) $exchange->id);

        $this->assertSame(ExchangeStatus::Cancelled, $found->getStatus());
        $this->assertSame('Out of stock for replacement', $found->cancelled_reason);
        $this->assertNotNull($found->cancelled_at);
    }

    // ── reason and enums ──────────────────────────────────────────────────────

    public function test_exchange_reason_persists_correctly(): void
    {
        $exchange = Exchange::initiate(
            'EXC-REASON-001',
            'sale-1', 'SALE-001',
            'term-1', 'sess-1', 'shift-1', 'cashier-1',
            null, 'EGP',
            [ExchangeLine::returned('l1', 'p1', 'Item', 'SKU', Quantity::of('1'), Money::of('50.00', 'EGP'))],
            [ExchangeLine::replacement('p2', 'New Item', 'SKU2', Quantity::of('1'), Money::of('50.00', 'EGP'))],
            ExchangeReason::Defective,
            'Item stopped working',
        );
        $this->repo->save($exchange);

        $found = $this->repo->findById((string) $exchange->id);

        $this->assertSame(ExchangeReason::Defective, $found->reason);
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private function makeExchange(
        string $exchangeNumber = 'EXC-001',
        string $saleId = 'sale-001',
        string $replacementPrice = '100.00',
    ): Exchange {
        return Exchange::initiate(
            $exchangeNumber,
            $saleId, 'SALE-0001',
            'term-1', 'sess-1', 'shift-1', 'cashier-1',
            null, 'EGP',
            [ExchangeLine::returned('line-01', 'prod-1', 'Blue Shirt S', 'SKU-S', Quantity::of('1'), Money::of('100.00', 'EGP'))],
            [ExchangeLine::replacement('prod-1', 'Blue Shirt M', 'SKU-M', Quantity::of('1'), Money::of($replacementPrice, 'EGP'))],
            ExchangeReason::SizeExchange,
        );
    }
}
