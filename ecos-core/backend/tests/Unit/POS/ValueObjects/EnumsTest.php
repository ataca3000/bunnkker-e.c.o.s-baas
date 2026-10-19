<?php

declare(strict_types=1);

namespace Tests\Unit\POS\ValueObjects;

use Modules\POS\Shared\Domain\Enums\CartStatus;
use Modules\POS\Shared\Domain\Enums\DiscountType;
use Modules\POS\Shared\Domain\Enums\PaymentMethodType;
use Modules\POS\Shared\Domain\Enums\ReturnReason;
use Modules\POS\Shared\Domain\Enums\RoundingMethod;
use Modules\POS\Shared\Domain\Enums\SaleStatus;
use Modules\POS\Shared\Domain\Enums\SessionStatus;
use Modules\POS\Shared\Domain\Enums\ShiftStatus;
use Modules\POS\Shared\Domain\Enums\TransactionType;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use PHPUnit\Framework\TestCase;

/**
 * PKG-POS-002: Domain enum helper method tests.
 */
final class EnumsTest extends TestCase
{
    // -------------------------------------------------------------------------
    // CartStatus
    // -------------------------------------------------------------------------

    public function test_cart_status_terminal_states(): void
    {
        $this->assertTrue(CartStatus::Completed->isTerminal());
        $this->assertTrue(CartStatus::Cancelled->isTerminal());
        $this->assertTrue(CartStatus::Expired->isTerminal());
        $this->assertFalse(CartStatus::Active->isTerminal());
        $this->assertFalse(CartStatus::Paying->isTerminal());
    }

    public function test_cart_status_can_add_items_only_when_active(): void
    {
        $this->assertTrue(CartStatus::Active->canAddItems());
        $this->assertFalse(CartStatus::Paying->canAddItems());
        $this->assertFalse(CartStatus::Held->canAddItems());
        $this->assertFalse(CartStatus::Empty->canAddItems());
    }

    public function test_cart_status_paying_to_active_back_transition_allowed(): void
    {
        // ADR-POS-010: Paying → Active is valid when no payment captured
        $this->assertTrue(CartStatus::Paying->canCancelPayment());
        $this->assertFalse(CartStatus::Active->canCancelPayment());
        $this->assertFalse(CartStatus::Completed->canCancelPayment());
    }

    public function test_cart_status_terminal_states_list(): void
    {
        $terminal = CartStatus::terminalStates();

        $this->assertContains(CartStatus::Completed, $terminal);
        $this->assertContains(CartStatus::Cancelled, $terminal);
        $this->assertContains(CartStatus::Expired, $terminal);
        $this->assertNotContains(CartStatus::Active, $terminal);
    }

    // -------------------------------------------------------------------------
    // SessionStatus
    // -------------------------------------------------------------------------

    public function test_session_status_is_active(): void
    {
        $this->assertTrue(SessionStatus::Open->isActive());
        $this->assertTrue(SessionStatus::Suspended->isActive());
        $this->assertTrue(SessionStatus::RecoveryPending->isActive());
        $this->assertFalse(SessionStatus::Closed->isActive());
    }

    public function test_session_status_can_transact_only_when_open(): void
    {
        $this->assertTrue(SessionStatus::Open->canTransact());
        $this->assertFalse(SessionStatus::Suspended->canTransact());
        $this->assertFalse(SessionStatus::RecoveryPending->canTransact());
    }

    public function test_session_recovery_pending_requires_supervisor(): void
    {
        $this->assertTrue(SessionStatus::RecoveryPending->requiresSupervisorReview());
        $this->assertFalse(SessionStatus::Open->requiresSupervisorReview());
    }

    // -------------------------------------------------------------------------
    // ShiftStatus
    // -------------------------------------------------------------------------

    public function test_shift_status_can_process_sales_only_when_open(): void
    {
        $this->assertTrue(ShiftStatus::Open->canProcessSales());
        $this->assertFalse(ShiftStatus::Closing->canProcessSales());
        $this->assertFalse(ShiftStatus::Closed->canProcessSales());
    }

    public function test_shift_status_closing_is_awaiting_approval(): void
    {
        $this->assertTrue(ShiftStatus::Closing->isAwaitingApproval());
        $this->assertFalse(ShiftStatus::Open->isAwaitingApproval());
    }

    public function test_shift_status_closed_is_terminal(): void
    {
        $this->assertTrue(ShiftStatus::Closed->isTerminal());
        $this->assertFalse(ShiftStatus::Closing->isTerminal());
    }

    // -------------------------------------------------------------------------
    // SaleStatus
    // -------------------------------------------------------------------------

    public function test_sale_status_can_be_refunded(): void
    {
        $this->assertTrue(SaleStatus::Completed->canBeRefunded());
        $this->assertTrue(SaleStatus::PartiallyRefunded->canBeRefunded());
        $this->assertFalse(SaleStatus::Voided->canBeRefunded());
        $this->assertFalse(SaleStatus::Pending->canBeRefunded());
    }

    public function test_sale_status_can_be_voided_only_pending(): void
    {
        $this->assertTrue(SaleStatus::Pending->canBeVoided());
        $this->assertFalse(SaleStatus::Completed->canBeVoided());
    }

    // -------------------------------------------------------------------------
    // PaymentMethodType
    // -------------------------------------------------------------------------

    public function test_payment_cash_requires_change_calculation(): void
    {
        $this->assertTrue(PaymentMethodType::Cash->requiresChangeCalculation());
        $this->assertFalse(PaymentMethodType::Card->requiresChangeCalculation());
        $this->assertFalse(PaymentMethodType::StoreCredit->requiresChangeCalculation());
    }

    public function test_payment_electronic_types(): void
    {
        $this->assertTrue(PaymentMethodType::Card->isElectronic());
        $this->assertTrue(PaymentMethodType::StoreCredit->isElectronic());
        $this->assertTrue(PaymentMethodType::LoyaltyPoints->isElectronic());
        $this->assertFalse(PaymentMethodType::Cash->isElectronic());
    }

    public function test_payment_account_based_types(): void
    {
        $this->assertTrue(PaymentMethodType::StoreCredit->isAccountBased());
        $this->assertTrue(PaymentMethodType::LoyaltyPoints->isAccountBased());
        $this->assertFalse(PaymentMethodType::Cash->isAccountBased());
        $this->assertFalse(PaymentMethodType::Card->isAccountBased());
    }

    // -------------------------------------------------------------------------
    // DiscountType
    // -------------------------------------------------------------------------

    public function test_discount_type_percentage_compute_amount(): void
    {
        $base = Money::of('100.00', 'EGP');
        $amount = DiscountType::Percentage->computeAmount($base, '10');

        $this->assertSame('10.00', $amount->amount);
    }

    public function test_discount_type_fixed_compute_amount(): void
    {
        $base = Money::of('100.00', 'EGP');
        $amount = DiscountType::FixedAmount->computeAmount($base, '25.00');

        $this->assertSame('25.00', $amount->amount);
    }

    // -------------------------------------------------------------------------
    // ReturnReason
    // -------------------------------------------------------------------------

    public function test_defective_should_not_restock(): void
    {
        $this->assertFalse(ReturnReason::Defective->shouldRestock());
        $this->assertTrue(ReturnReason::WrongItem->shouldRestock());
        $this->assertTrue(ReturnReason::CustomerPreference->shouldRestock());
        $this->assertTrue(ReturnReason::Other->shouldRestock());
    }

    // -------------------------------------------------------------------------
    // TransactionType
    // -------------------------------------------------------------------------

    public function test_cash_drawer_movements_always_affect_drawer(): void
    {
        $this->assertTrue(TransactionType::CashIn->alwaysAffectsCashDrawer());
        $this->assertTrue(TransactionType::CashOut->alwaysAffectsCashDrawer());
        $this->assertTrue(TransactionType::OpeningFloat->alwaysAffectsCashDrawer());
        $this->assertTrue(TransactionType::ClosingCount->alwaysAffectsCashDrawer());
        $this->assertFalse(TransactionType::Sale->alwaysAffectsCashDrawer());
        $this->assertFalse(TransactionType::Return->alwaysAffectsCashDrawer());
    }

    public function test_drawer_movement_types(): void
    {
        $this->assertTrue(TransactionType::CashIn->isDrawerMovement());
        $this->assertTrue(TransactionType::CashOut->isDrawerMovement());
        $this->assertTrue(TransactionType::OpeningFloat->isDrawerMovement());
        $this->assertFalse(TransactionType::ClosingCount->isDrawerMovement());
        $this->assertFalse(TransactionType::Sale->isDrawerMovement());
    }

    // -------------------------------------------------------------------------
    // RoundingMethod
    // -------------------------------------------------------------------------

    public function test_rounding_method_nearest(): void
    {
        $result = RoundingMethod::Nearest->round('10.37', '0.25');

        $this->assertSame('10.25', $result);
    }

    public function test_rounding_method_up(): void
    {
        $result = RoundingMethod::Up->round('10.01', '0.25');

        $this->assertSame('10.25', $result);
    }

    public function test_rounding_method_down(): void
    {
        $result = RoundingMethod::Down->round('10.49', '0.25');

        $this->assertSame('10.25', $result);
    }

    public function test_rounding_whole_unit_unchanged(): void
    {
        $result = RoundingMethod::Nearest->round('10.00', '0.25');

        $this->assertSame('10.00', $result);
    }
}
