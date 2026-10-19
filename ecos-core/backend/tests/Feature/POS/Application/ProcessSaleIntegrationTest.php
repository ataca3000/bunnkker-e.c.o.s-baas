<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Application;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\POS\Application\Commands\ProcessSaleCommand;
use Modules\POS\Application\Results\ProcessSaleResult;
use Modules\POS\Application\Services\ProcessSaleService;
use Modules\POS\Cart\Domain\Contracts\CartRepositoryInterface;
use Modules\POS\Cart\Domain\Models\Cart;
use Modules\POS\Receipt\Domain\Contracts\ReceiptRepositoryInterface;
use Modules\POS\Sale\Domain\Contracts\SaleRepositoryInterface;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Quantity;
use Tests\TestCase;

/**
 * PKG-POS-017: ProcessSaleService integration tests.
 *
 * Requires PostgreSQL — run with:
 *   php artisan test tests/Feature/POS/Application/ProcessSaleIntegrationTest.php
 */
final class ProcessSaleIntegrationTest extends TestCase
{
    use RefreshDatabase;

    private ProcessSaleService $service;

    private CartRepositoryInterface $cartRepo;

    private SaleRepositoryInterface $saleRepo;

    private ReceiptRepositoryInterface $receiptRepo;

    private const SESSION_ID = 'a1000000-0000-4000-a000-000000000001';

    private const SHIFT_ID = 'b1000000-0000-4000-b000-000000000001';

    private const TERMINAL_ID = 'c1000000-0000-4000-c000-000000000001';

    private const CASHIER_ID = 'd1000000-0000-4000-d000-000000000001';

    private const CURRENCY = 'EGP';

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = app(ProcessSaleService::class);
        $this->cartRepo = app(CartRepositoryInterface::class);
        $this->saleRepo = app(SaleRepositoryInterface::class);
        $this->receiptRepo = app(ReceiptRepositoryInterface::class);
    }

    public function test_processes_sale_and_persists_all_entities(): void
    {
        $cart = $this->makePersistedCart();

        $result = $this->service->execute(new ProcessSaleCommand(
            cartId: (string) $cart->id,
            sessionId: self::SESSION_ID,
            shiftId: self::SHIFT_ID,
            terminalId: self::TERMINAL_ID,
            cashierId: self::CASHIER_ID,
            customerId: null,
            currency: self::CURRENCY,
            payments: [['type' => 'cash', 'amount' => '100.00', 'currency' => self::CURRENCY]],
            cashierName: 'Ali Hassan',
        ));

        $this->assertInstanceOf(ProcessSaleResult::class, $result);
        $this->assertNotEmpty($result->saleId);
        $this->assertNotEmpty($result->receiptId);
    }

    public function test_sale_record_exists_in_database(): void
    {
        $cart = $this->makePersistedCart();

        $result = $this->service->execute(new ProcessSaleCommand(
            cartId: (string) $cart->id,
            sessionId: self::SESSION_ID,
            shiftId: self::SHIFT_ID,
            terminalId: self::TERMINAL_ID,
            cashierId: self::CASHIER_ID,
            customerId: null,
            currency: self::CURRENCY,
            payments: [['type' => 'cash', 'amount' => '100.00', 'currency' => self::CURRENCY]],
            cashierName: 'Ali Hassan',
        ));

        $sale = $this->saleRepo->findById($result->saleId);
        $this->assertNotNull($sale);
        $this->assertSame('100.00', $sale->getTotal()->amount);
        $this->assertSame(self::CURRENCY, $sale->currency);
    }

    public function test_receipt_record_exists_in_database(): void
    {
        $cart = $this->makePersistedCart();

        $result = $this->service->execute(new ProcessSaleCommand(
            cartId: (string) $cart->id,
            sessionId: self::SESSION_ID,
            shiftId: self::SHIFT_ID,
            terminalId: self::TERMINAL_ID,
            cashierId: self::CASHIER_ID,
            customerId: null,
            currency: self::CURRENCY,
            payments: [['type' => 'cash', 'amount' => '100.00', 'currency' => self::CURRENCY]],
            cashierName: 'Ali Hassan',
        ));

        $receipt = $this->receiptRepo->findById($result->receiptId);
        $this->assertNotNull($receipt);
        $this->assertSame($result->receiptNumber, $receipt->receipt_number);
    }

    public function test_cart_is_completed_after_sale(): void
    {
        $cart = $this->makePersistedCart();
        $cartId = (string) $cart->id;

        $this->service->execute(new ProcessSaleCommand(
            cartId: $cartId,
            sessionId: self::SESSION_ID,
            shiftId: self::SHIFT_ID,
            terminalId: self::TERMINAL_ID,
            cashierId: self::CASHIER_ID,
            customerId: null,
            currency: self::CURRENCY,
            payments: [['type' => 'cash', 'amount' => '100.00', 'currency' => self::CURRENCY]],
            cashierName: 'Ali Hassan',
        ));

        $refreshed = $this->cartRepo->findById($cartId);
        $this->assertTrue($refreshed->isCompleted());
    }

    public function test_result_totals_match_cart_total(): void
    {
        $cart = $this->makePersistedCart();

        $result = $this->service->execute(new ProcessSaleCommand(
            cartId: (string) $cart->id,
            sessionId: self::SESSION_ID,
            shiftId: self::SHIFT_ID,
            terminalId: self::TERMINAL_ID,
            cashierId: self::CASHIER_ID,
            customerId: null,
            currency: self::CURRENCY,
            payments: [['type' => 'cash', 'amount' => '120.00', 'currency' => self::CURRENCY]],
            cashierName: 'Ali Hassan',
        ));

        $this->assertSame('100.00', $result->totalAmount);
        $this->assertSame('120.00', $result->amountPaid);
        $this->assertSame('20.00', $result->changeGiven);
        $this->assertSame(self::CURRENCY, $result->currency);
    }

    private function makePersistedCart(): Cart
    {
        $cart = Cart::open(
            sessionId: self::SESSION_ID,
            shiftId: self::SHIFT_ID,
            terminalId: self::TERMINAL_ID,
            cashierId: self::CASHIER_ID,
            currency: self::CURRENCY,
        );

        $cart->addLine('prod-1', 'Widget', 'WGT-001', Quantity::of('1'), Money::of('100.00', self::CURRENCY));

        $this->cartRepo->save($cart);

        return $cart;
    }
}
