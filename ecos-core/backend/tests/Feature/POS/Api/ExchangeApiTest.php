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
 * PKG-POS-019: Exchange API endpoint.
 */
final class ExchangeApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private SaleRepositoryInterface $saleRepo;

    private const SESSION_ID = 'a0000000-0000-4000-a000-000000000032';

    private const SHIFT_ID = 'b0000000-0000-4000-b000-000000000032';

    private const TERMINAL_ID = 'c0000000-0000-4000-c000-000000000032';

    private const CASHIER_ID = 'd0000000-0000-4000-d000-000000000032';

    private const PRODUCT_A_ID = 'e0000000-0000-4000-e000-000000000032';

    private const PRODUCT_B_ID = 'f0000000-0000-4000-f000-000000000032';

    private const CURRENCY = 'EGP';

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->saleRepo = app(SaleRepositoryInterface::class);
    }

    public function test_process_exchange_returns_201_with_exchange_data(): void
    {
        $sale = $this->makePersistedSale();

        $response = $this->actingAs($this->user)
            ->postJson('/api/pos/exchanges', $this->makePayload((string) $sale->id));

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => [
                'exchange_id', 'exchange_number', 'receipt_id', 'receipt_number',
            ]]);
    }

    public function test_exchange_number_follows_sequential_format(): void
    {
        $sale = $this->makePersistedSale();

        $response = $this->actingAs($this->user)
            ->postJson('/api/pos/exchanges', $this->makePayload((string) $sale->id));

        $exchangeNumber = $response->json('data.exchange_number');
        $this->assertStringStartsWith('EXC-', $exchangeNumber);
    }

    public function test_process_exchange_validates_required_fields(): void
    {
        $this->actingAs($this->user)
            ->postJson('/api/pos/exchanges', [])
            ->assertStatus(422);
    }

    public function test_process_exchange_validates_returned_lines_required(): void
    {
        $sale = $this->makePersistedSale();

        $this->actingAs($this->user)
            ->postJson('/api/pos/exchanges', [
                'original_sale_id' => (string) $sale->id,
                'cashier_id' => self::CASHIER_ID,
                'currency' => self::CURRENCY,
                'reason' => 'defective',
                // missing returned_lines and replacement_lines
            ])
            ->assertStatus(422);
    }

    public function test_process_exchange_returns_404_for_missing_sale(): void
    {
        $this->actingAs($this->user)
            ->postJson('/api/pos/exchanges', $this->makePayload('00000000-0000-4000-0000-000000000000'))
            ->assertStatus(404);
    }

    public function test_process_exchange_requires_authentication(): void
    {
        $this->postJson('/api/pos/exchanges', [])
            ->assertStatus(401);
    }

    private function makePersistedSale(): Sale
    {
        $sale = Sale::record(
            cartId: 'a0000000-cart-4000-a000-000000000032',
            paymentId: 'a0000000-pay0-4000-a000-000000000032',
            sessionId: self::SESSION_ID,
            shiftId: self::SHIFT_ID,
            terminalId: self::TERMINAL_ID,
            cashierId: self::CASHIER_ID,
            customerId: null,
            currency: self::CURRENCY,
            receiptNumber: 'SALE-EXC-API-001',
            lines: [
                new SaleLine(
                    'ln-exc-api-1', self::PRODUCT_A_ID, 'Widget A', 'WGT-001',
                    Quantity::of('1'), Money::of('100.00', self::CURRENCY),
                    null, null,
                    Money::of('100.00', self::CURRENCY), 0,
                ),
            ],
            subtotal: Money::of('100.00', self::CURRENCY),
            discountTotal: Money::of('0.00', self::CURRENCY),
            total: Money::of('100.00', self::CURRENCY),
            amountPaid: Money::of('100.00', self::CURRENCY),
            changeGiven: Money::of('0.00', self::CURRENCY),
            paymentSummaries: [
                new PaymentSummaryLine(
                    PaymentMethodType::Cash,
                    Money::of('100.00', self::CURRENCY),
                    null,
                ),
            ],
        );

        $sale->complete();
        $this->saleRepo->save($sale);

        return $sale;
    }

    /** @return array<string, mixed> */
    private function makePayload(string $saleId): array
    {
        return [
            'original_sale_id' => $saleId,
            'cashier_id' => self::CASHIER_ID,
            'currency' => self::CURRENCY,
            'reason' => 'defective',
            'returned_lines' => [
                [
                    'original_line_id' => 'ln-exc-api-1',
                    'product_id' => self::PRODUCT_A_ID,
                    'product_name' => 'Widget A',
                    'sku' => 'WGT-001',
                    'quantity' => '1',
                    'unit_price' => ['amount' => '100.00', 'currency' => self::CURRENCY],
                    'line_total' => ['amount' => '100.00', 'currency' => self::CURRENCY],
                    'sort_order' => 0,
                ],
            ],
            'replacement_lines' => [
                [
                    'original_line_id' => null,
                    'product_id' => self::PRODUCT_B_ID,
                    'product_name' => 'Widget B',
                    'sku' => 'WGT-002',
                    'quantity' => '1',
                    'unit_price' => ['amount' => '100.00', 'currency' => self::CURRENCY],
                    'line_total' => ['amount' => '100.00', 'currency' => self::CURRENCY],
                    'sort_order' => 0,
                ],
            ],
        ];
    }
}
