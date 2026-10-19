<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\POS\Cart\Domain\Models\Cart;
use Tests\TestCase;

/**
 * PKG-POS-018: Cart API endpoints.
 */
final class CartApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private const SESSION_ID = 'a0000000-0000-4000-a000-000000000010';

    private const SHIFT_ID = 'b0000000-0000-4000-b000-000000000010';

    private const TERMINAL_ID = 'c0000000-0000-4000-c000-000000000010';

    private const CASHIER_ID = 'd0000000-0000-4000-d000-000000000010';

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    private function openCart(): string
    {
        $response = $this->actingAs($this->user)
            ->postJson('/api/pos/carts', [
                'session_id' => self::SESSION_ID,
                'shift_id' => self::SHIFT_ID,
                'terminal_id' => self::TERMINAL_ID,
                'cashier_id' => self::CASHIER_ID,
                'currency' => 'EGP',
            ]);

        $response->assertStatus(201);

        return $response->json('data.id');
    }

    public function test_open_cart_returns_201(): void
    {
        $response = $this->actingAs($this->user)
            ->postJson('/api/pos/carts', [
                'session_id' => self::SESSION_ID,
                'shift_id' => self::SHIFT_ID,
                'terminal_id' => self::TERMINAL_ID,
                'cashier_id' => self::CASHIER_ID,
                'currency' => 'EGP',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.currency', 'EGP')
            ->assertJsonPath('data.status', 'active');
    }

    public function test_open_cart_validates_required_fields(): void
    {
        $this->actingAs($this->user)
            ->postJson('/api/pos/carts', [])
            ->assertStatus(422);
    }

    public function test_get_cart_returns_cart_with_lines(): void
    {
        $cartId = $this->openCart();
        $response = $this->actingAs($this->user)
            ->getJson('/api/pos/carts/'.$cartId);

        $response->assertStatus(200)
            ->assertJsonPath('data.id', $cartId)
            ->assertJsonPath('data.lines', []);
    }

    public function test_add_line_to_cart_returns_201(): void
    {
        $cartId = $this->openCart();
        $response = $this->actingAs($this->user)
            ->postJson('/api/pos/carts/'.$cartId.'/lines', [
                'product_id' => 'e0000000-0000-4000-e000-000000000010',
                'product_name' => 'Test Product',
                'sku' => 'TST-001',
                'quantity' => '2',
                'unit_price' => '50.00',
                'currency' => 'EGP',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => ['cart_id', 'line_id']]);
    }

    public function test_remove_line_from_cart_returns_200(): void
    {
        $cartId = $this->openCart();
        $lineResult = $this->actingAs($this->user)
            ->postJson('/api/pos/carts/'.$cartId.'/lines', [
                'product_id' => 'e0000000-0000-4000-e000-000000000011',
                'product_name' => 'Remove Me',
                'sku' => 'TST-002',
                'quantity' => '1',
                'unit_price' => '25.00',
                'currency' => 'EGP',
            ]);

        $lineId = $lineResult->json('data.line_id');

        $response = $this->actingAs($this->user)
            ->deleteJson('/api/pos/carts/'.$cartId.'/lines/'.$lineId);

        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_hold_cart_returns_200(): void
    {
        $cartId = $this->openCart();

        $this->actingAs($this->user)
            ->postJson('/api/pos/carts/'.$cartId.'/hold')
            ->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_resume_cart_returns_200(): void
    {
        $cartId = $this->openCart();
        $this->actingAs($this->user)->postJson('/api/pos/carts/'.$cartId.'/hold');

        $this->actingAs($this->user)
            ->deleteJson('/api/pos/carts/'.$cartId.'/hold')
            ->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_cancel_cart_returns_200(): void
    {
        $cartId = $this->openCart();

        $this->actingAs($this->user)
            ->deleteJson('/api/pos/carts/'.$cartId)
            ->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_get_cart_returns_404_when_not_found(): void
    {
        $this->actingAs($this->user)
            ->getJson('/api/pos/carts/00000000-0000-4000-0000-000000000000')
            ->assertStatus(404);
    }
}
