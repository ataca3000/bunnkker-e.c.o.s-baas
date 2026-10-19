<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Customer;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\POS\Customer\Domain\Exceptions\CustomerNotFoundException;
use Modules\POS\Customer\Domain\ValueObjects\CustomerSnapshot;
use Modules\POS\Customer\Infrastructure\Gateways\SalesCustomerGateway;
use Modules\Sales\Customers\Domain\Models\Customer;
use Tests\TestCase;

final class SalesCustomerGatewayTest extends TestCase
{
    use RefreshDatabase;

    private SalesCustomerGateway $gateway;

    protected function setUp(): void
    {
        parent::setUp();

        $this->gateway = new SalesCustomerGateway;
    }

    // ── findById() ────────────────────────────────────────────────────────────

    public function test_find_by_id_returns_snapshot_for_active_customer(): void
    {
        $customer = $this->makeCustomer();

        $snapshot = $this->gateway->findById((string) $customer->id);

        $this->assertInstanceOf(CustomerSnapshot::class, $snapshot);
        $this->assertSame((string) $customer->id, $snapshot->customerId);
        $this->assertSame($customer->name, $snapshot->name);
    }

    public function test_find_by_id_captured_at_is_utc(): void
    {
        $customer = $this->makeCustomer();

        $snapshot = $this->gateway->findById((string) $customer->id);

        $this->assertSame('UTC', $snapshot->capturedAt->getTimezone()->getName());
    }

    public function test_find_by_id_maps_email_and_phone(): void
    {
        $customer = $this->makeCustomer(email: 'test@example.com', phone: '0501234567');

        $snapshot = $this->gateway->findById((string) $customer->id);

        $this->assertSame('test@example.com', $snapshot->email);
        $this->assertSame('0501234567', $snapshot->phone);
    }

    public function test_find_by_id_throws_for_unknown_id(): void
    {
        $this->expectException(CustomerNotFoundException::class);
        $this->expectExceptionMessage('not found');

        $this->gateway->findById('00000000-0000-0000-0000-000000000000');
    }

    public function test_find_by_id_throws_for_inactive_customer(): void
    {
        $customer = $this->makeCustomer(active: false);

        $this->expectException(CustomerNotFoundException::class);

        $this->gateway->findById((string) $customer->id);
    }

    // ── findByPhone() ─────────────────────────────────────────────────────────

    public function test_find_by_phone_returns_snapshot(): void
    {
        $this->makeCustomer(phone: '01012345678');

        $snapshot = $this->gateway->findByPhone('01012345678');

        $this->assertInstanceOf(CustomerSnapshot::class, $snapshot);
    }

    public function test_find_by_phone_matches_mobile_field(): void
    {
        Customer::create([
            'code' => 'C-MOB',
            'name' => 'Mobile Only',
            'phone' => null,
            'mobile' => '01198765432',
            'is_active' => true,
        ]);

        $snapshot = $this->gateway->findByPhone('01198765432');

        $this->assertSame('Mobile Only', $snapshot->name);
    }

    public function test_find_by_phone_throws_when_not_found(): void
    {
        $this->expectException(CustomerNotFoundException::class);
        $this->expectExceptionMessage('phone');

        $this->gateway->findByPhone('00000000000');
    }

    // ── findByEmail() ─────────────────────────────────────────────────────────

    public function test_find_by_email_returns_snapshot(): void
    {
        $this->makeCustomer(email: 'john@shop.com');

        $snapshot = $this->gateway->findByEmail('john@shop.com');

        $this->assertInstanceOf(CustomerSnapshot::class, $snapshot);
    }

    public function test_find_by_email_throws_when_not_found(): void
    {
        $this->expectException(CustomerNotFoundException::class);
        $this->expectExceptionMessage('email');

        $this->gateway->findByEmail('nobody@nowhere.com');
    }

    public function test_find_by_email_throws_for_inactive_customer(): void
    {
        $this->makeCustomer(email: 'inactive@shop.com', active: false);

        $this->expectException(CustomerNotFoundException::class);

        $this->gateway->findByEmail('inactive@shop.com');
    }

    // ── findByCode() ──────────────────────────────────────────────────────────

    public function test_find_by_code_returns_snapshot(): void
    {
        $this->makeCustomer(code: 'CUST-777');

        $snapshot = $this->gateway->findByCode('CUST-777');

        $this->assertSame('CUST-777', $snapshot->customerCode);
    }

    public function test_find_by_code_throws_when_not_found(): void
    {
        $this->expectException(CustomerNotFoundException::class);
        $this->expectExceptionMessage('code');

        $this->gateway->findByCode('UNKNOWN-CODE');
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private function makeCustomer(
        string $code = 'C-001',
        string $email = 'customer@example.com',
        string $phone = '0501000000',
        bool $active = true,
    ): Customer {
        return Customer::create([
            'code' => $code,
            'name' => 'Test Customer',
            'email' => $email,
            'phone' => $phone,
            'mobile' => null,
            'is_active' => $active,
        ]);
    }
}
