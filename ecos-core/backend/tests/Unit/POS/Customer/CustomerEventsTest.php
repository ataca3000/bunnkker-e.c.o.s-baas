<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Customer;

use DateTimeImmutable;
use Modules\POS\Customer\Domain\Enums\CustomerLookupType;
use Modules\POS\Customer\Domain\Events\CustomerIdentified;
use Modules\POS\Customer\Domain\Events\LoyaltyPointsEarned;
use Modules\POS\Customer\Domain\Events\LoyaltyPointsRedeemed;
use Modules\POS\Customer\Domain\Events\StoreCreditApplied;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use PHPUnit\Framework\TestCase;

final class CustomerEventsTest extends TestCase
{
    // ── CustomerIdentified ────────────────────────────────────────────────────

    public function test_customer_identified_implements_domain_event(): void
    {
        $event = CustomerIdentified::now('c1', 'C001', 'Jane Doe', true, false, CustomerLookupType::ByPhone);

        $this->assertInstanceOf(DomainEvent::class, $event);
    }

    public function test_customer_identified_event_name(): void
    {
        $event = CustomerIdentified::now('c1', 'C001', 'Jane', true, true, CustomerLookupType::ById);

        $this->assertSame('pos.customer.customer_identified', $event->eventName());
    }

    public function test_customer_identified_version_is_one(): void
    {
        $event = CustomerIdentified::now('c1', 'C001', 'Jane', false, false, CustomerLookupType::ByCode);

        $this->assertSame(1, $event->eventVersion());
    }

    public function test_customer_identified_occurred_at_is_utc(): void
    {
        $event = CustomerIdentified::now('c1', 'C001', 'Jane', false, false, CustomerLookupType::ByEmail);

        $this->assertInstanceOf(DateTimeImmutable::class, $event->occurredAt());
        $this->assertSame('UTC', $event->occurredAt()->getTimezone()->getName());
    }

    public function test_customer_identified_unique_ids(): void
    {
        $e1 = CustomerIdentified::now('c1', 'C1', 'A', true, true, CustomerLookupType::ById);
        $e2 = CustomerIdentified::now('c1', 'C1', 'A', true, true, CustomerLookupType::ById);

        $this->assertNotSame($e1->eventId(), $e2->eventId());
    }

    public function test_customer_identified_correlation_id_equals_event_id(): void
    {
        $event = CustomerIdentified::now('c1', 'C001', 'Jane', true, false, CustomerLookupType::ByCode);

        $this->assertSame($event->eventId(), $event->correlationId());
    }

    public function test_customer_identified_to_array_keys(): void
    {
        $event = CustomerIdentified::now('cust-1', 'C001', 'Jane', true, false, CustomerLookupType::ByPhone);
        $array = $event->toArray();

        $this->assertArrayHasKey('event_id', $array);
        $this->assertArrayHasKey('event_name', $array);
        $this->assertArrayHasKey('occurred_at', $array);
        $this->assertArrayHasKey('event_version', $array);
        $this->assertArrayHasKey('correlation_id', $array);
        $this->assertArrayHasKey('customer_id', $array);
        $this->assertArrayHasKey('customer_code', $array);
        $this->assertArrayHasKey('name', $array);
        $this->assertArrayHasKey('has_email', $array);
        $this->assertArrayHasKey('has_phone', $array);
        $this->assertArrayHasKey('lookup_type', $array);
    }

    public function test_customer_identified_carries_correct_payload(): void
    {
        $event = CustomerIdentified::now('cust-1', 'C001', 'Jane Doe', true, false, CustomerLookupType::ByEmail);

        $this->assertSame('cust-1', $event->customerId);
        $this->assertSame('C001', $event->customerCode);
        $this->assertSame('Jane Doe', $event->name);
        $this->assertTrue($event->hasEmail);
        $this->assertFalse($event->hasPhone);
        $this->assertSame(CustomerLookupType::ByEmail, $event->lookupType);
    }

    // ── LoyaltyPointsEarned ───────────────────────────────────────────────────

    public function test_loyalty_points_earned_implements_domain_event(): void
    {
        $event = LoyaltyPointsEarned::now('c1', 100, Money::of('100.00', 'EGP'), 'TXN-001');

        $this->assertInstanceOf(DomainEvent::class, $event);
    }

    public function test_loyalty_points_earned_event_name(): void
    {
        $event = LoyaltyPointsEarned::now('c1', 100, Money::of('100.00', 'EGP'), 'TXN-001');

        $this->assertSame('pos.customer.loyalty_points_earned', $event->eventName());
    }

    public function test_loyalty_points_earned_version_is_one(): void
    {
        $event = LoyaltyPointsEarned::now('c1', 50, Money::of('50.00', 'EGP'), 'TXN-002');

        $this->assertSame(1, $event->eventVersion());
    }

    public function test_loyalty_points_earned_occurred_at_is_utc(): void
    {
        $event = LoyaltyPointsEarned::now('c1', 10, Money::of('10.00', 'EGP'), 'TXN-003');

        $this->assertInstanceOf(DateTimeImmutable::class, $event->occurredAt());
        $this->assertSame('UTC', $event->occurredAt()->getTimezone()->getName());
    }

    public function test_loyalty_points_earned_unique_ids(): void
    {
        $saleTotal = Money::of('100.00', 'EGP');
        $e1 = LoyaltyPointsEarned::now('c1', 100, $saleTotal, 'TXN-1');
        $e2 = LoyaltyPointsEarned::now('c1', 100, $saleTotal, 'TXN-2');

        $this->assertNotSame($e1->eventId(), $e2->eventId());
    }

    public function test_loyalty_points_earned_to_array_keys(): void
    {
        $event = LoyaltyPointsEarned::now('c1', 100, Money::of('100.00', 'EGP'), 'TXN-001');
        $array = $event->toArray();

        $this->assertArrayHasKey('event_id', $array);
        $this->assertArrayHasKey('event_name', $array);
        $this->assertArrayHasKey('occurred_at', $array);
        $this->assertArrayHasKey('event_version', $array);
        $this->assertArrayHasKey('correlation_id', $array);
        $this->assertArrayHasKey('customer_id', $array);
        $this->assertArrayHasKey('points_earned', $array);
        $this->assertArrayHasKey('sale_total_amount', $array);
        $this->assertArrayHasKey('sale_total_currency', $array);
        $this->assertArrayHasKey('transaction_ref', $array);
    }

    // ── LoyaltyPointsRedeemed ─────────────────────────────────────────────────

    public function test_loyalty_points_redeemed_implements_domain_event(): void
    {
        $event = LoyaltyPointsRedeemed::now('c1', 100, Money::of('1.00', 'EGP'), 'TXN-001');

        $this->assertInstanceOf(DomainEvent::class, $event);
    }

    public function test_loyalty_points_redeemed_event_name(): void
    {
        $event = LoyaltyPointsRedeemed::now('c1', 100, Money::of('1.00', 'EGP'), 'TXN-001');

        $this->assertSame('pos.customer.loyalty_points_redeemed', $event->eventName());
    }

    public function test_loyalty_points_redeemed_version_is_one(): void
    {
        $event = LoyaltyPointsRedeemed::now('c1', 50, Money::of('0.50', 'EGP'), 'TXN-002');

        $this->assertSame(1, $event->eventVersion());
    }

    public function test_loyalty_points_redeemed_occurred_at_is_utc(): void
    {
        $event = LoyaltyPointsRedeemed::now('c1', 50, Money::of('0.50', 'EGP'), 'TXN-003');

        $this->assertInstanceOf(DateTimeImmutable::class, $event->occurredAt());
        $this->assertSame('UTC', $event->occurredAt()->getTimezone()->getName());
    }

    public function test_loyalty_points_redeemed_to_array_keys(): void
    {
        $event = LoyaltyPointsRedeemed::now('c1', 100, Money::of('1.00', 'EGP'), 'TXN-001');
        $array = $event->toArray();

        $this->assertArrayHasKey('event_id', $array);
        $this->assertArrayHasKey('correlation_id', $array);
        $this->assertArrayHasKey('points_redeemed', $array);
        $this->assertArrayHasKey('monetary_value_amount', $array);
        $this->assertArrayHasKey('monetary_value_currency', $array);
        $this->assertArrayHasKey('transaction_ref', $array);
    }

    // ── StoreCreditApplied ────────────────────────────────────────────────────

    public function test_store_credit_applied_implements_domain_event(): void
    {
        $event = StoreCreditApplied::now('c1', Money::of('50.00', 'EGP'), 'TXN-001');

        $this->assertInstanceOf(DomainEvent::class, $event);
    }

    public function test_store_credit_applied_event_name(): void
    {
        $event = StoreCreditApplied::now('c1', Money::of('50.00', 'EGP'), 'TXN-001');

        $this->assertSame('pos.customer.store_credit_applied', $event->eventName());
    }

    public function test_store_credit_applied_version_is_one(): void
    {
        $event = StoreCreditApplied::now('c1', Money::of('50.00', 'EGP'), 'TXN-001');

        $this->assertSame(1, $event->eventVersion());
    }

    public function test_store_credit_applied_occurred_at_is_utc(): void
    {
        $event = StoreCreditApplied::now('c1', Money::of('50.00', 'EGP'), 'TXN-001');

        $this->assertInstanceOf(DateTimeImmutable::class, $event->occurredAt());
        $this->assertSame('UTC', $event->occurredAt()->getTimezone()->getName());
    }

    public function test_store_credit_applied_unique_ids(): void
    {
        $amount = Money::of('25.00', 'EGP');
        $e1 = StoreCreditApplied::now('c1', $amount, 'TXN-1');
        $e2 = StoreCreditApplied::now('c1', $amount, 'TXN-2');

        $this->assertNotSame($e1->eventId(), $e2->eventId());
    }

    public function test_store_credit_applied_correlation_id_equals_event_id(): void
    {
        $event = StoreCreditApplied::now('c1', Money::of('30.00', 'EGP'), 'TXN-001');

        $this->assertSame($event->eventId(), $event->correlationId());
    }

    public function test_store_credit_applied_to_array_keys(): void
    {
        $event = StoreCreditApplied::now('c1', Money::of('30.00', 'EGP'), 'TXN-001');
        $array = $event->toArray();

        $this->assertArrayHasKey('event_id', $array);
        $this->assertArrayHasKey('event_name', $array);
        $this->assertArrayHasKey('occurred_at', $array);
        $this->assertArrayHasKey('event_version', $array);
        $this->assertArrayHasKey('correlation_id', $array);
        $this->assertArrayHasKey('customer_id', $array);
        $this->assertArrayHasKey('amount_applied_amount', $array);
        $this->assertArrayHasKey('amount_applied_currency', $array);
        $this->assertArrayHasKey('transaction_ref', $array);
    }
}
