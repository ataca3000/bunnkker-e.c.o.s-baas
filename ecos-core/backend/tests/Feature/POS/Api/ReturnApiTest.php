<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\POS\Sale\Domain\Contracts\SaleRepositoryInterface;
use Modules\POS\Sale\Domain\Models\Sale;
use Modules\POS\Sale\Domain\ValueObjects\PaymentSummaryLine;
use Modules\POS\Sale\Domain\ValueObjects\SaleLine;
use Modules\POS\Shared\Domain\Enums\PaymentMethodType;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Quantity;
use Tests\TestCase;

/**
 * PKG-POS-019: Return API endpoint.
 */
final class ReturnApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private SaleRepositoryInterface $saleRepo;

    private const SESSION_ID = 'a0000000-0000-4000-a000-000000000031';

    private const SHIFT_ID = 'b0000000-0000-4000-b000-000000000031';

    private const TERMINAL_ID = 'c0000000-0000-4000-c000-000000000031';

    private const CASHIER_ID = 'd0000000-0000-4000-d000-000000000031';

    private const PRODUCT_ID = 'e0000000-0000-4000-e000-000000000031';

    private const CURRENCY = 'EGP';

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->saleRepo = app(SaleRepositoryInterface::class);
    }

    public function test_process_return_returns_201_with_return_data(): void
    {
        $sale = $this->makePersistedSale('100.00');
        $saleId = (string) $sale->id;

        $response = $this->actingAs($this->user)
            ->postJson('/api/pos/returns', $this->makePayload($saleId, '100.00'));

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => [
                'return_id', 'return_number', 'receipt_id',
                'receipt_number', 'refund_amount', 'currency',
            ]]);
    }

    public function test_return_number_follows_sequential_format(): void
    {
        $sale = $this->makePersistedSale('100.00');
        $saleId = (string) $sale->id;

        $response = $this->actingAs($this->user)
            ->postJson('/api/pos/returns', $this->makePayload($saleId, '100.00'));

        $returnNumber = $response->json('data.return_number');
        $this->assertStringStartsWith('RTN-', $returnNumber);
    }

    public function test_process_return_validates_required_fields(): void
    {
        $this->actingAs($this->user)
            ->postJson('/api/pos/returns', [])
            ->assertStatus(422);
    }

    public function test_process_return_validates_lines_required(): void
    {
        $sale = $this->makePersistedSale('100.00');

        $this->actingAs($this->user)
            ->postJson('/api/pos/returns', [
                'sale_id' => (string) $sale->id,
                'cashier_id' => self::CASHIER_ID,
                'currency' => self::CURRENCY,
                'refund_total' => '100.00',
                'refund_method' => 'cash',
                // missing lines
            ])
            ->assertStatus(422);
    }

    public function test_process_return_returns_404_for_missing_sale(): void
    {
        $this->actingAs($this->user)
            ->postJson('/api/pos/returns', $this->makePayload('00000000-0000-4000-0000-000000000000', '100.00'))
            ->assertStatus(404);
    }

    public function test_process_return_requires_authentication(): void
    {
        $this->postJson('/api/pos/returns', [])
            ->assertStatus(401);
    }

    private function makePersistedSale(string $total): Sale
    {
        $sale = Sale::record(
            cartId: 'a0000000-cart-4000-a000-000000000031',
            paymentId: 'a0000000-pay0-4000-a000-000000000031',
            sessionId: self::SESSION_ID,
            shiftId: self::SHIFT_ID,
            terminalId: self::TERMINAL_ID,
            cashierId: self::CASHIER_ID,
            customerId: null,
            currency: self::CURRENCY,
            receiptNumber: 'SALE-RTN-API-001',
            lines: [
                new SaleLine(
                    'ln-rtn-api-1', self::PRODUCT_ID, 'Widget', 'WGT-001',
                    Quantity::of('1'), Money::of($total, self::CURRENCY),
                    null, null,
                    Money::of($total, self::CURRENCY), 0,
                ),
            ],
            subtotal: Money::of($total, self::CURRENCY),
            discountTotal: Money::of('0.00', self::CURRENCY),
            total: Money::of($total, self::CURRENCY),
            amountPaid: Money::of($total, self::CURRENCY),
            changeGiven: Money::of('0.00', self::CURRENCY),
            paymentSummaries: [
                new PaymentSummaryLine(
                    PaymentMethodType::Cash,
                    Money::of($total, self::CURRENCY),
                    null,
                ),
            ],
        );

        $sale->complete();
        $this->saleRepo->save($sale);

        return $sale;
    }

    /** @return array<string, mixed> */
    private function makePayload(string $saleId, string $refundAmount): array
    {
        return [
            'sale_id' => $saleId,
            'cashier_id' => self::CASHIER_ID,
            'currency' => self::CURRENCY,
            'refund_total' => $refundAmount,
            'refund_method' => 'cash',
            'lines' => [
                [
                    'line_id' => 'ln-rtn-api-1',
                    'product_id' => self::PRODUCT_ID,
                    'product_name' => 'Widget',
                    'sku' => 'WGT-001',
                    'quantity' => '1',
                    'unit_price' => ['amount' => '100.00', 'currency' => self::CURRENCY],
                    'refund_amount' => ['amount' => $refundAmount, 'currency' => self::CURRENCY],
                    'reason' => 'customer_preference',
                    'should_restock' => true,
                    'sort_order' => 0,
                ],
            ],
        ];
    }
}
