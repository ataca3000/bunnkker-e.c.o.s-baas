<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Customer;

use DateTimeImmutable;
use InvalidArgumentException;
use Modules\POS\Customer\Domain\Contracts\CustomerGatewayInterface;
use Modules\POS\Customer\Domain\Contracts\LoyaltyGatewayInterface;
use Modules\POS\Customer\Domain\Contracts\StoreCreditGatewayInterface;
use Modules\POS\Customer\Domain\Enums\CustomerLookupType;
use Modules\POS\Customer\Domain\Events\CustomerIdentified;
use Modules\POS\Customer\Domain\Events\LoyaltyPointsEarned;
use Modules\POS\Customer\Domain\Events\LoyaltyPointsRedeemed;
use Modules\POS\Customer\Domain\Events\StoreCreditApplied;
use Modules\POS\Customer\Domain\Exceptions\CustomerNotFoundException;
use Modules\POS\Customer\Domain\Services\CustomerResolutionService;
use Modules\POS\Customer\Domain\Services\CustomerValidator;
use Modules\POS\Customer\Domain\ValueObjects\CustomerSnapshot;
use Modules\POS\Customer\Domain\ValueObjects\LoyaltyBalance;
use Modules\POS\Customer\Domain\ValueObjects\StoreCreditBalance;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use PHPUnit\Framework\TestCase;

// ── Test doubles ─────────────────────────────────────────────────────────────

final class StubCustomerGateway implements CustomerGatewayInterface
{
    private array $byId = [];

    private array $byPhone = [];

    private array $byEmail = [];

    private array $byCode = [];

    public function add(CustomerSnapshot $snapshot): void
    {
        $this->byId[$snapshot->customerId] = $snapshot;
        if ($snapshot->phone) {
            $this->byPhone[$snapshot->phone] = $snapshot;
        }
        if ($snapshot->email) {
            $this->byEmail[$snapshot->email] = $snapshot;
        }
        $this->byCode[$snapshot->customerCode] = $snapshot;
    }

    public function findById(string $customerId): CustomerSnapshot
    {
        return $this->byId[$customerId] ?? throw CustomerNotFoundException::withId($customerId);
    }

    public function findByPhone(string $phone): CustomerSnapshot
    {
        return $this->byPhone[$phone] ?? throw CustomerNotFoundException::withPhone($phone);
    }

    public function findByEmail(string $email): CustomerSnapshot
    {
        return $this->byEmail[$email] ?? throw CustomerNotFoundException::withEmail($email);
    }

    public function findByCode(string $code): CustomerSnapshot
    {
        return $this->byCode[$code] ?? throw CustomerNotFoundException::withCode($code);
    }
}

final class StubLoyaltyGateway implements LoyaltyGatewayInterface
{
    public int $pointsToEarn = 10;

    public int $balance = 500;

    public function getBalance(string $customerId, string $currency): LoyaltyBalance
    {
        return LoyaltyBalance::of($customerId, $this->balance, Money::of('5.00', $currency));
    }

    public function earnPoints(string $customerId, Money $saleTotal, string $transactionRef): int
    {
        return $this->pointsToEarn;
    }

    public function redeemPoints(string $customerId, int $points, string $currency, string $transactionRef): Money
    {
        return Money::of(number_format($points * 0.01, 2, '.', ''), $currency);
    }
}

final class StubStoreCreditGateway implements StoreCreditGatewayInterface
{
    public function getBalance(string $customerId, string $currency): StoreCreditBalance
    {
        return StoreCreditBalance::of(
            $customerId,
            Money::of('200.00', $currency),
            Money::zero($currency),
        );
    }

    public function applyCredit(string $customerId, Money $amount, string $transactionRef): void
    {
        // no-op in tests
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

final class CustomerResolutionServiceTest extends TestCase
{
    private StubCustomerGateway $customerGateway;

    private StubLoyaltyGateway $loyaltyGateway;

    private StubStoreCreditGateway $storeCreditGateway;

    private CustomerResolutionService $service;

    private CustomerSnapshot $snapshot;

    protected function setUp(): void
    {
        $this->customerGateway = new StubCustomerGateway;
        $this->loyaltyGateway = new StubLoyaltyGateway;
        $this->storeCreditGateway = new StubStoreCreditGateway;

        $this->service = new CustomerResolutionService(
            customerGateway: $this->customerGateway,
            loyaltyGateway: $this->loyaltyGateway,
            storeCreditGateway: $this->storeCreditGateway,
            validator: new CustomerValidator,
        );

        $this->snapshot = CustomerSnapshot::capture(
            '550e8400-e29b-41d4-a716-446655440000',
            'C001',
            'Jane Doe',
            'jane@example.com',
            '0501234567',
            new DateTimeImmutable('now'),
        );

        $this->customerGateway->add($this->snapshot);
    }

    // ── identify() ────────────────────────────────────────────────────────────

    public function test_identify_by_id_returns_snapshot(): void
    {
        $result = $this->service->identify(
            '550e8400-e29b-41d4-a716-446655440000',
            CustomerLookupType::ById,
        );

        $this->assertSame($this->snapshot->customerId, $result->customerId);
    }

    public function test_identify_by_phone_returns_snapshot(): void
    {
        $result = $this->service->identify('0501234567', CustomerLookupType::ByPhone);

        $this->assertSame($this->snapshot->customerId, $result->customerId);
    }

    public function test_identify_by_email_returns_snapshot(): void
    {
        $result = $this->service->identify('jane@example.com', CustomerLookupType::ByEmail);

        $this->assertSame($this->snapshot->customerId, $result->customerId);
    }

    public function test_identify_by_code_returns_snapshot(): void
    {
        $result = $this->service->identify('C001', CustomerLookupType::ByCode);

        $this->assertSame($this->snapshot->customerId, $result->customerId);
    }

    public function test_identify_fires_customer_identified_event(): void
    {
        $this->service->identify('C001', CustomerLookupType::ByCode);
        $events = $this->service->pullDomainEvents();

        $this->assertCount(1, $events);
        $this->assertInstanceOf(CustomerIdentified::class, $events[0]);
    }

    public function test_identify_rejects_empty_lookup(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->service->identify('', CustomerLookupType::ByCode);
    }

    public function test_identify_propagates_not_found_exception(): void
    {
        $this->expectException(CustomerNotFoundException::class);

        $this->service->identify('550e8400-0000-0000-0000-000000000000', CustomerLookupType::ById);
    }

    // ── getLoyaltyBalance() ───────────────────────────────────────────────────

    public function test_get_loyalty_balance_returns_balance(): void
    {
        $balance = $this->service->getLoyaltyBalance(
            '550e8400-e29b-41d4-a716-446655440000',
            'EGP',
        );

        $this->assertSame(500, $balance->points);
    }

    public function test_get_loyalty_balance_rejects_invalid_id(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->service->getLoyaltyBalance('not-a-uuid', 'EGP');
    }

    // ── getStoreCreditBalance() ───────────────────────────────────────────────

    public function test_get_store_credit_balance_returns_balance(): void
    {
        $balance = $this->service->getStoreCreditBalance(
            '550e8400-e29b-41d4-a716-446655440000',
            'EGP',
        );

        $this->assertSame('200.00', $balance->available->amount);
    }

    // ── earnLoyaltyPoints() ───────────────────────────────────────────────────

    public function test_earn_loyalty_points_returns_points_earned(): void
    {
        $this->loyaltyGateway->pointsToEarn = 15;

        $earned = $this->service->earnLoyaltyPoints(
            '550e8400-e29b-41d4-a716-446655440000',
            Money::of('150.00', 'EGP'),
            'TXN-001',
        );

        $this->assertSame(15, $earned);
    }

    public function test_earn_loyalty_points_fires_event_when_positive(): void
    {
        $this->loyaltyGateway->pointsToEarn = 10;

        $this->service->earnLoyaltyPoints(
            '550e8400-e29b-41d4-a716-446655440000',
            Money::of('100.00', 'EGP'),
            'TXN-001',
        );

        $events = $this->service->pullDomainEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(LoyaltyPointsEarned::class, $events[0]);
    }

    public function test_earn_loyalty_points_does_not_fire_event_when_zero(): void
    {
        $this->loyaltyGateway->pointsToEarn = 0;

        $this->service->earnLoyaltyPoints(
            '550e8400-e29b-41d4-a716-446655440000',
            Money::of('5.00', 'EGP'),
            'TXN-001',
        );

        $this->assertEmpty($this->service->pullDomainEvents());
    }

    // ── redeemLoyaltyPoints() ─────────────────────────────────────────────────

    public function test_redeem_loyalty_points_returns_monetary_value(): void
    {
        $money = $this->service->redeemLoyaltyPoints(
            '550e8400-e29b-41d4-a716-446655440000',
            100,
            'EGP',
            'TXN-001',
        );

        $this->assertSame('1.00', $money->amount);
        $this->assertSame('EGP', $money->currency);
    }

    public function test_redeem_loyalty_points_fires_event(): void
    {
        $this->service->redeemLoyaltyPoints(
            '550e8400-e29b-41d4-a716-446655440000',
            50,
            'EGP',
            'TXN-001',
        );

        $events = $this->service->pullDomainEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(LoyaltyPointsRedeemed::class, $events[0]);
    }

    // ── applyStoreCredit() ────────────────────────────────────────────────────

    public function test_apply_store_credit_fires_event(): void
    {
        $this->service->applyStoreCredit(
            '550e8400-e29b-41d4-a716-446655440000',
            Money::of('50.00', 'EGP'),
            'TXN-001',
        );

        $events = $this->service->pullDomainEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(StoreCreditApplied::class, $events[0]);
    }

    // ── pullDomainEvents() ────────────────────────────────────────────────────

    public function test_pull_domain_events_clears_queue(): void
    {
        $this->service->identify('C001', CustomerLookupType::ByCode);

        $this->service->pullDomainEvents(); // first pull
        $second = $this->service->pullDomainEvents(); // should be empty

        $this->assertEmpty($second);
    }

    public function test_multiple_operations_accumulate_events(): void
    {
        $this->service->identify('C001', CustomerLookupType::ByCode);
        $this->loyaltyGateway->pointsToEarn = 5;
        $this->service->earnLoyaltyPoints(
            '550e8400-e29b-41d4-a716-446655440000',
            Money::of('50.00', 'EGP'),
            'TXN-001',
        );

        $events = $this->service->pullDomainEvents();
        $this->assertCount(2, $events);
    }
}
