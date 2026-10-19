<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * PKG-POS-018: Sale API endpoints.
 */
final class SaleApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private const SESSION_ID = 'a0000000-0000-4000-a000-000000000020';

    private const SHIFT_ID = 'b0000000-0000-4000-b000-000000000020';

    private const TERMINAL_ID = 'c0000000-0000-4000-c000-000000000020';

    private const CASHIER_ID = 'd0000000-0000-4000-d000-000000000020';

    private const PRODUCT_ID = 'e0000000-0000-4000-e000-000000000020';

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    private function openCartWithLine(): string
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
                'product_name' => 'Product A',
                'sku' => 'PRD-A',
                'quantity' => '1',
                'unit_price' => '100.00',
                'currency' => 'EGP',
            ]);

        return $cartId;
    }

    public function test_process_sale_returns_201_with_sale_data(): void
    {
        $cartId = $this->openCartWithLine();
        $response = $this->actingAs($this->user)
            ->postJson('/api/pos/sales', [
                'cart_id' => $cartId,
                'payments' => [
                    ['method' => 'cash', 'amount' => '120.00'],
                ],
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => [
                'sale_id', 'receipt_id', 'receipt_number',
                'total', 'amount_paid', 'change_given', 'currency',
            ]]);
    }

    public function test_process_sale_validates_required_fields(): void
    {
        $this->actingAs($this->user)
            ->postJson('/api/pos/sales', [])
            ->assertStatus(422);
    }

    public function test_get_sale_returns_sale_data(): void
    {
        $cartId = $this->openCartWithLine();
        $saleResponse = $this->actingAs($this->user)
            ->postJson('/api/pos/sales', [
                'cart_id' => $cartId,
                'payments' => [['method' => 'cash', 'amount' => '100.00']],
            ]);

        $saleId = $saleResponse->json('data.sale_id');

        $response = $this->actingAs($this->user)
            ->getJson('/api/pos/sales/'.$saleId);

        $response->assertStatus(200)
            ->assertJsonPath('data.id', $saleId);
    }

    public function test_get_sale_returns_404_when_not_found(): void
    {
        $this->actingAs($this->user)
            ->getJson('/api/pos/sales/00000000-0000-4000-0000-000000000000')
            ->assertStatus(404);
    }

    public function test_process_sale_with_empty_cart_returns_422(): void
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
            ->postJson('/api/pos/sales', [
                'cart_id' => $cartId,
                'payments' => [['method' => 'cash', 'amount' => '0.00']],
            ])
            ->assertStatus(422);
    }
}
