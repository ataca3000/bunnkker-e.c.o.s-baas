<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * PKG-POS-018: Receipt API endpoints.
 */
final class ReceiptApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private const SESSION_ID = 'a0000000-0000-4000-a000-000000000030';

    private const SHIFT_ID = 'b0000000-0000-4000-b000-000000000030';

    private const TERMINAL_ID = 'c0000000-0000-4000-c000-000000000030';

    private const CASHIER_ID = 'd0000000-0000-4000-d000-000000000030';

    private const PRODUCT_ID = 'e0000000-0000-4000-e000-000000000030';

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    private function processASale(): array
    {
        $cartResponse = $this->actingAs($this->user)
            ->postJson('/api/pos/carts', [
                'session_id' => self::SESSION_ID,
                'shift_id' => self::SHIFT_ID,
                'terminal_id' => self::TERMINAL_ID,
                'cashier_id' => self::CASHIER_ID,
                'currency' => 'EGP',
            ]);
        $cartId = $cartResponse->json('data.id');

        $this->actingAs($this->user)
            ->postJson('/api/pos/carts/'.$cartId.'/lines', [
                'product_id' => self::PRODUCT_ID,
                'product_name' => 'Receipt Test Product',
                'sku' => 'RCP-001',
                'quantity' => '1',
                'unit_price' => '75.00',
                'currency' => 'EGP',
            ]);

        $saleResponse = $this->actingAs($this->user)
            ->postJson('/api/pos/sales', [
                'cart_id' => $cartId,
                'payments' => [['method' => 'cash', 'amount' => '75.00']],
            ]);

        return $saleResponse->json('data');
    }

    public function test_get_receipt_returns_receipt_data(): void
    {
        $saleData = $this->processASale();
        $receiptId = $saleData['receipt_id'];

        $response = $this->actingAs($this->user)
            ->getJson('/api/pos/receipts/'.$receiptId);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', $receiptId)
            ->assertJsonStructure(['data' => [
                'id', 'receipt_number', 'type', 'status', 'currency',
                'line_items', 'totals', 'payments', 'issued_at',
            ]]);
    }

    public function test_get_receipt_returns_404_when_not_found(): void
    {
        $this->actingAs($this->user)
            ->getJson('/api/pos/receipts/00000000-0000-4000-0000-000000000000')
            ->assertStatus(404);
    }

    public function test_reprint_receipt_returns_200(): void
    {
        $saleData = $this->processASale();
        $receiptId = $saleData['receipt_id'];

        $response = $this->actingAs($this->user)
            ->postJson('/api/pos/receipts/'.$receiptId.'/reprint', [
                'cashier_id' => self::CASHIER_ID,
                'terminal_id' => self::TERMINAL_ID,
                'reason' => 'Customer request',
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.reprint_count', 1);
    }

    public function test_void_receipt_returns_200(): void
    {
        $saleData = $this->processASale();
        $receiptId = $saleData['receipt_id'];

        $response = $this->actingAs($this->user)
            ->deleteJson('/api/pos/receipts/'.$receiptId, [
                'cashier_id' => self::CASHIER_ID,
                'reason' => 'Manager override',
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_reprint_voided_receipt_returns_422(): void
    {
        $saleData = $this->processASale();
        $receiptId = $saleData['receipt_id'];

        $this->actingAs($this->user)
            ->deleteJson('/api/pos/receipts/'.$receiptId, [
                'cashier_id' => self::CASHIER_ID,
            ]);

        $this->actingAs($this->user)
            ->postJson('/api/pos/receipts/'.$receiptId.'/reprint', [
                'cashier_id' => self::CASHIER_ID,
                'terminal_id' => self::TERMINAL_ID,
                'reason' => 'Retry after void',
            ])
            ->assertStatus(422);
    }
}
