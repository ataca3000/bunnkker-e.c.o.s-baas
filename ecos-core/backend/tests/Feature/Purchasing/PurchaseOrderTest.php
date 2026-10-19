<?php

declare(strict_types=1);

namespace Tests\Feature\Purchasing;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Purchasing\PurchaseOrders\Application\Actions\ApprovePurchaseOrderAction;
use Modules\Purchasing\PurchaseOrders\Application\Actions\CancelPurchaseOrderAction;
use Modules\Purchasing\PurchaseOrders\Application\Actions\SubmitPurchaseOrderAction;
use Modules\Purchasing\PurchaseOrders\Domain\Enums\PurchaseOrderStatus;
use Modules\Purchasing\PurchaseOrders\Domain\Exceptions\InvalidPurchaseOrderStatusException;
use Modules\Purchasing\PurchaseOrders\Domain\Models\PurchaseOrder;
use Modules\Purchasing\PurchaseOrders\Domain\Models\PurchaseOrderLine;
use Tests\TestCase;

class PurchaseOrderTest extends TestCase
{
    use RefreshDatabase;

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    private function makeDraftPo(): PurchaseOrder
    {
        $po = PurchaseOrder::factory()->create();

        PurchaseOrderLine::factory()->create([
            'purchase_order_id' => $po->id,
            'quantity' => 100,
            'received_qty' => 0,
        ]);

        return $po->refresh();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Draft
    // ──────────────────────────────────────────────────────────────────────────

    public function test_po_is_created_in_draft_status(): void
    {
        $po = $this->makeDraftPo();

        $this->assertEquals(PurchaseOrderStatus::Draft, $po->status);
        $this->assertCount(1, $po->lines);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Submit
    // ──────────────────────────────────────────────────────────────────────────

    public function test_submit_advances_draft_to_submitted(): void
    {
        $po = $this->makeDraftPo();
        $result = app(SubmitPurchaseOrderAction::class)->execute($po->id);

        $this->assertTrue($result->isSuccess());
        $this->assertEquals(PurchaseOrderStatus::Submitted, $po->fresh()->status);
    }

    public function test_submit_already_submitted_throws(): void
    {
        $po = PurchaseOrder::factory()->submitted()->create();

        $this->expectException(InvalidPurchaseOrderStatusException::class);
        app(SubmitPurchaseOrderAction::class)->execute($po->id);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Approve
    // ──────────────────────────────────────────────────────────────────────────

    public function test_approve_advances_submitted_to_approved(): void
    {
        $po = PurchaseOrder::factory()->submitted()->create();

        $result = app(ApprovePurchaseOrderAction::class)->execute($po->id);

        $this->assertTrue($result->isSuccess());
        $fresh = $po->fresh();
        $this->assertEquals(PurchaseOrderStatus::Approved, $fresh->status);
        $this->assertNotNull($fresh->approved_at);
    }

    public function test_approve_draft_directly_throws(): void
    {
        $po = $this->makeDraftPo();

        $this->expectException(InvalidPurchaseOrderStatusException::class);
        app(ApprovePurchaseOrderAction::class)->execute($po->id);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Cancel
    // ──────────────────────────────────────────────────────────────────────────

    public function test_cancel_draft_po(): void
    {
        $po = $this->makeDraftPo();
        $result = app(CancelPurchaseOrderAction::class)->execute($po->id);

        $this->assertTrue($result->isSuccess());
        $this->assertEquals(PurchaseOrderStatus::Cancelled, $po->fresh()->status);
    }

    public function test_cancel_submitted_po(): void
    {
        $po = PurchaseOrder::factory()->submitted()->create();

        $result = app(CancelPurchaseOrderAction::class)->execute($po->id);

        $this->assertTrue($result->isSuccess());
        $this->assertEquals(PurchaseOrderStatus::Cancelled, $po->fresh()->status);
    }

    public function test_cancel_approved_po_throws_invalid_status(): void
    {
        $po = PurchaseOrder::factory()->approved()->create();

        $this->expectException(InvalidPurchaseOrderStatusException::class);
        app(CancelPurchaseOrderAction::class)->execute($po->id);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Forbidden transitions
    // ──────────────────────────────────────────────────────────────────────────

    public function test_draft_cannot_be_approved_directly(): void
    {
        $po = $this->makeDraftPo();

        $this->expectException(InvalidPurchaseOrderStatusException::class);
        app(ApprovePurchaseOrderAction::class)->execute($po->id);
    }

    public function test_cancelled_po_cannot_be_submitted(): void
    {
        $po = PurchaseOrder::factory()->cancelled()->create();

        $this->expectException(InvalidPurchaseOrderStatusException::class);
        app(SubmitPurchaseOrderAction::class)->execute($po->id);
    }
}
