<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Enums\ReservationStatus;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Orders\Domain\Models\OrderNote;
use Modules\Commerce\Orders\Domain\Models\OrderReservationAudit;

/**
 * @mixin Order
 */
final class OrderResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        // Single source of truth for all canonical financial fields.
        // The model stores raw inputs; all monetary values are computed here once.
        $rawDiscount = (float) ($this->discount_amount ?? 0);
        $subtotal = (float) ($this->subtotal ?? 0);
        $wcDiscount = (float) ($this->discount_total ?? 0);
        $discountAmt = match ($this->discount_type) {
            'percentage' => round($subtotal * $rawDiscount / 100, 2),
            'fixed' => $rawDiscount,
            default => max($rawDiscount, $wcDiscount),
        };
        $shippingAmt = $this->shipping_cost !== null
            ? (float) $this->shipping_cost
            : (float) ($this->shipping_total ?? 0);
        $taxAmt = (float) ($this->tax_total ?? 0);
        $depositPaid = (float) ($this->deposit_amount ?? 0);
        $grandTotal = round($subtotal + $shippingAmt - $discountAmt + $taxAmt, 2);
        $remainingBalance = round($grandTotal - $depositPaid, 2);

        return [
            'id' => $this->id,
            'channel_id' => $this->channel_id,
            'channel' => $this->whenLoaded('channel', fn () => [
                'id' => $this->channel->id,
                'name' => $this->channel->name,
                'type' => $this->channel->channel_type,
                'brand_id' => $this->channel->brand_id,
            ]),
            'customer_id' => $this->customer_id,
            'customer' => $this->whenLoaded('customer', function () {
                $c = $this->customer;
                $data = [
                    'id' => $c->id,
                    'code' => $c->code,
                    // ── Order snapshot fields ─────────────────────────────────────────
                    // These three are stored on the order at creation/edit time and must
                    // never be overwritten by changes to the Customer profile.
                    // Falls back to the Customer record only for legacy orders that
                    // predate the snapshot migration (2026-07-14).
                    'name' => $this->customer_name ?? $c->name,
                    'mobile' => $this->customer_secondary_phone ?? $c->mobile,
                    'notes' => $this->customer_notes ?? $c->notes,
                    // ── billing_phone is already an order-level snapshot ──────────────
                    'phone' => $this->billing_phone ?? $c->phone,
                    // ── CRM fields — current customer profile (for reference only) ───
                    'email' => $c->email,
                    'city' => $c->city,
                    'governorate' => $c->governorate,
                    'area' => $c->area,
                    'address' => $c->address,
                    'is_active' => $c->is_active,
                    'created_at' => $c->created_at?->toIso8601String(),
                    'stats' => null,
                ];
                // Customer order stats — computed only on the detail endpoint.
                // The detail endpoint loads coupons; the list endpoint does not.
                // This prevents N+1 on list pages.
                if ($this->resource->relationLoaded('coupons')) {
                    $stats = \Illuminate\Support\Facades\DB::table('orders')
                        ->where('customer_id', $this->customer_id)
                        ->whereNull('deleted_at')
                        ->selectRaw('COUNT(*) as total_orders, SUM(total) as lifetime_value, MIN(order_date) as first_order_date, MAX(order_date) as last_order_date')
                        ->first();
                    $data['stats'] = [
                        'total_orders' => (int) ($stats?->total_orders ?? 0),
                        'lifetime_value' => (float) ($stats?->lifetime_value ?? 0),
                        'first_order_date' => $stats?->first_order_date ?? null,
                        'last_order_date' => $stats?->last_order_date ?? null,
                    ];
                }

                return $data;
            }),
            'external_order_id' => $this->external_order_id,
            'order_number' => $this->order_number,
            'order_date' => $this->order_date?->toDateString(),
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'previous_status' => $this->previous_status,
            'status_entered_by' => $this->status_entered_by,
            'status_entered_at' => $this->status_entered_at?->toIso8601String(),
            'subtotal' => (float) $this->subtotal,
            'shipping_total' => (float) $this->shipping_total,
            'discount_total' => (float) $this->discount_total,
            'tax_total' => (float) $this->tax_total,
            'total' => (float) $this->total,
            // ── Canonical financial summary (TASK-007) ──────────────────────────
            // Resolved at the API layer — resolves WooCommerce vs enterprise field families.
            // All display screens must read these, not the raw WC fields above.
            'products_total' => $subtotal,
            'shipping_amount' => $shippingAmt,
            'discount_value' => $rawDiscount,
            'discount_percentage' => $this->discount_type === 'percentage' ? $rawDiscount : null,
            'tax_amount' => $taxAmt,
            'grand_total' => $grandTotal,
            'deposit_paid' => $depositPaid,
            'notes' => $this->notes,
            'customer_note' => $this->customer_note,
            'internal_notes' => $this->internal_notes,
            'created_by_id' => $this->created_by_id,
            'created_by_name' => $this->created_by_name,
            'order_notes_list' => $this->whenLoaded('orderNotes', fn () => $this->orderNotes->map(
                fn (OrderNote $n) => [
                    'id' => $n->id,
                    'type' => $n->type,
                    'content' => $n->content,
                    'user_id' => $n->user_id,
                    'user_name' => $n->user_name,
                    'user_role' => $n->user_role,
                    'is_edited' => (bool) $n->is_edited,
                    'edited_by_id' => $n->edited_by_id,
                    'edited_by_name' => $n->edited_by_name,
                    'edited_at' => $n->edited_at?->toIso8601String(),
                    'created_at' => $n->created_at->toIso8601String(),
                    'updated_at' => $n->updated_at->toIso8601String(),
                ],
            )->values()->all(), []),
            'billing_first_name' => $this->billing_first_name,
            'billing_last_name' => $this->billing_last_name,
            'billing_company' => $this->billing_company,
            'billing_country' => $this->billing_country,
            'billing_state' => $this->billing_state,
            'billing_city' => $this->billing_city,
            'billing_address_1' => $this->billing_address_1,
            'billing_address_2' => $this->billing_address_2,
            'billing_postcode' => $this->billing_postcode,
            'billing_phone' => $this->billing_phone,
            'billing_email' => $this->billing_email,
            'shipping_first_name' => $this->shipping_first_name,
            'shipping_last_name' => $this->shipping_last_name,
            'shipping_company' => $this->shipping_company,
            'shipping_country' => $this->shipping_country,
            'shipping_state' => $this->shipping_state,
            'shipping_city' => $this->shipping_city,
            'shipping_address_1' => $this->shipping_address_1,
            'shipping_address_2' => $this->shipping_address_2,
            'shipping_postcode' => $this->shipping_postcode,
            'payment_method' => $this->payment_method,
            'payment_method_title' => $this->payment_method_title,
            'transaction_id' => $this->transaction_id,
            'date_paid' => $this->date_paid?->toIso8601String(),
            'shipping_method' => $this->shipping_method,
            'fees' => $this->whenLoaded('fees', fn () => $this->fees->map(fn ($fee) => [
                'id' => $fee->id,
                'name' => $fee->name,
                'total' => (float) $fee->total,
            ])),
            'coupons' => $this->whenLoaded('coupons', fn () => $this->coupons->map(fn ($coupon) => [
                'id' => $coupon->id,
                'code' => $coupon->code,
                'discount' => (float) $coupon->discount,
            ])),
            'lines' => $this->whenLoaded('lines', fn () => $this->lines->map(fn ($line) => [
                'id' => $line->id,
                'product_id' => $line->product_id,
                'product' => $line->relationLoaded('product') ? [
                    'id' => $line->product->id,
                    'sku' => $line->product->sku,
                    'name' => $line->product->name,
                    'image_url' => $line->product->image_url,
                    'unit_name' => $line->product->relationLoaded('unit') ? $line->product->unit?->name : null,
                ] : null,
                'quantity' => (float) $line->quantity,
                'unit_price' => (float) $line->unit_price,
                'line_total' => (float) $line->line_total,
                'manufacturing_state' => $line->manufacturing_state?->value,
                'manufacturing_state_label' => $line->manufacturing_state?->label(),
                'manufacturing_started_at' => $line->manufacturing_started_at?->toIso8601String(),
                'manufacturing_completed_at' => $line->manufacturing_completed_at?->toIso8601String(),
                // Fulfillment quantities (TASK-ORDER-PRODUCTION-CLOSURE-001 PART 2)
                'reserved_qty' => (float) ($line->reserved_qty ?? 0),
                'available_qty' => (float) ($line->available_qty ?? 0),
                'prepared_qty' => (float) ($line->prepared_qty ?? 0),
                'packed_qty' => (float) ($line->packed_qty ?? 0),
                'loaded_qty' => (float) ($line->loaded_qty ?? 0),
                'delivered_qty' => (float) ($line->delivered_qty ?? 0),
                'returned_qty' => (float) ($line->returned_qty ?? 0),
                'cancelled_qty' => (float) ($line->cancelled_qty ?? 0),
                'warehouse_name' => $line->warehouse_name ?? null,
                'batch_number' => $line->batch_number ?? null,
            ])),
            'inventory_reserved_at' => $this->inventory_reserved_at?->toIso8601String(),
            'inventory_shipped_at' => $this->inventory_shipped_at?->toIso8601String(),
            'inventory_released_at' => $this->inventory_released_at?->toIso8601String(),
            'reservation_status' => $this->reservation_status?->value,
            'reservation_failure_reason' => $this->reservation_failure_reason,
            'reservation_shortage_lines' => $this->resolveReservationShortageLines(),
            'partial_reservation_approved_at' => $this->partial_reservation_approved_at?->toIso8601String(),
            'partial_reservation_approved_by' => $this->partial_reservation_approved_by,
            'partial_reservation_approval_notes' => $this->partial_reservation_approval_notes,
            'requested_delivery_date' => $this->requested_delivery_date?->toDateString(),
            'preferred_delivery_time' => $this->preferred_delivery_time,
            'delivery_window_id' => $this->delivery_window_id,
            'delivery_window' => $this->delivery_window,
            'delivery_zone_id' => $this->delivery_zone_id,
            'delivery_zone' => $this->delivery_zone,
            'payment_method_manual' => $this->payment_method_manual,
            'payment_proof_path' => $this->payment_proof_path,
            'governorate' => $this->governorate,
            'city' => $this->city,
            'shipping_address' => $this->shipping_address,
            'building' => $this->building,
            'floor' => $this->floor,
            'apartment' => $this->apartment,
            'landmark' => $this->landmark,
            'address_notes' => $this->address_notes,
            'area' => $this->area,
            'shipping_cost' => $this->shipping_cost !== null ? (float) $this->shipping_cost : null,
            'shipping_cost_source' => $this->shipping_cost_source,
            'discount_amount' => (float) ($this->discount_amount ?? 0),
            'discount_type' => $this->discount_type,
            'deposit_amount' => $depositPaid,
            'remaining_balance' => $remainingBalance,
            // Shipping logistics
            'shipping_company_name' => $this->shipping_company_name,
            'shipping_attempts' => (int) ($this->shipping_attempts ?? 0),
            'tracking_number' => $this->tracking_number,
            // GPS location with provenance
            'location' => $this->google_maps_lat !== null
                ? [
                    'lat' => (float) $this->google_maps_lat,
                    'lng' => (float) $this->google_maps_lng,
                    'set_by' => $this->location_set_by,
                ]
                : null,
            'google_maps_url' => $this->google_maps_url,
            'location_source' => $this->location_source,
            // Channel type (derived)
            'source' => $this->whenLoaded('channel', fn () => $this->channel?->channel_type),
            'assigned_warehouse_id' => $this->assigned_warehouse_id,
            // Customer confirmation
            'customer_confirmed_at' => $this->customer_confirmed_at?->toIso8601String(),
            'customer_confirmed_by' => $this->customer_confirmed_by,
            'confirmation_result' => $this->confirmation_result,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
            // ── Workflow contract (TASK-ORDER-WORKFLOW-STATUS-API-REFINEMENT-001) ─
            // Frontend is fully decoupled from workflow implementation details.
            // current_status* mirror the root status fields for the selector widget.
            // allowed_status_transitions uses target_status (business state), not action keys.
            'current_status' => $this->status->value,
            'current_status_label' => $this->status->label(),
            'allowed_status_transitions' => $this->resolveAllowedTransitions(),
        ];
    }

    /**
     * P1-003 — Reservation shortage lines for business visibility.
     *
     * Returns per-product shortage details from the latest partial/awaiting-stock
     * reservation audit so the UI can show exactly what is missing and how much.
     * Only populated when reservation_status is PartialReserved or AwaitingStock.
     *
     * @return list<array{product_id: string, requested: float, reserved: float, outcome: string}>
     */
    private function resolveReservationShortageLines(): array
    {
        $relevant = [ReservationStatus::PartialReserved, ReservationStatus::AwaitingStock];
        if (! in_array($this->reservation_status, $relevant, true)) {
            return [];
        }

        $audit = OrderReservationAudit::where('order_id', $this->id)
            ->whereIn('to_status', [
                ReservationStatus::PartialReserved->value,
                ReservationStatus::AwaitingStock->value,
            ])
            ->latest('created_at')
            ->first();

        if ($audit === null) {
            return [];
        }

        $lines = $audit->meta['lines'] ?? [];

        return array_values(
            array_filter($lines, fn (array $l) => in_array($l['outcome'] ?? '', ['partial', 'none'], true)),
        );
    }

    /**
     * V2 allowed workflow transitions (TASK-ORDER-WORKFLOW-V2-001).
     *
     * CONTRACT:
     *   - target_status  : business state — frontend uses this as the Select value
     *   - label          : display string (uses official V2 status labels)
     *   - requires_reason: UX prompts for reason before confirming
     *   - action         : opaque workflow key — for audit/transparency only; frontend must NOT route on this
     *
     * Canonical status order:
     * V3 lifecycle (TASK-ORDERS-LIFECYCLE-ARCH-002):
     *   New → In Progress → Ready for Dispatch → Out for Delivery → Delivered
     *
     * @return list<array{target_status: string, label: string, requires_reason: bool, action: string}>
     */
    private function resolveAllowedTransitions(): array
    {
        $t = static fn (string $target, string $label, bool $reason = false, string $action = ''): array => [
            'target_status'   => $target,
            'label'           => $label,
            'requires_reason' => $reason,
            'action'          => $action,
        ];

        return match ($this->status) {
            // ── New: pre-activation — FulfillmentEngine auto-triggers on creation ─
            OrderStatus::NewOrder => [
                $t('in_progress',      'Start Processing',   false, 'initiate_order'),
                $t('awaiting_payment', 'Awaiting Payment',   false, 'set_early_status'),
                $t('scheduled',        'Schedule',           false, 'set_early_status'),
                $t('on_hold',          'Put On Hold',        true,  'put_on_hold'),
                $t('cancelled',        'Cancel',             true,  'cancel_order'),
            ],
            // ── Scheduled: future-dated — activate when date arrives ──────────────
            OrderStatus::Scheduled => [
                $t('new',             'Reset to New',       false, 'return_to_new'),
                $t('in_progress',     'Activate Now',       false, 'initiate_order'),
                $t('on_hold',         'Put On Hold',        true,  'put_on_hold'),
                $t('cancelled',       'Cancel',             true,  'cancel_order'),
            ],
            // ── Awaiting Payment: pending payment verification ────────────────────
            OrderStatus::AwaitingPayment => [
                $t('new',             'Reset to New',       false, 'return_to_new'),
                $t('in_progress',     'Start Processing',   false, 'initiate_order'),
                $t('awaiting_stock',  'Awaiting Stock',     false, 'mark_awaiting_stock'),
                $t('on_hold',         'Put On Hold',        true,  'put_on_hold'),
                $t('cancelled',       'Cancel',             true,  'cancel_order'),
            ],
            // ── In Progress: operational — engines running ────────────────────────
            OrderStatus::InProgress => [
                $t('ready_for_dispatch', 'Mark Ready',      false, 'ready_for_dispatch'),
                $t('new',                'Return to New',   false, 'return_to_new'),
                $t('awaiting_payment',   'Awaiting Payment', false, 'set_early_status'),
                $t('awaiting_stock',     'Awaiting Stock',  false, 'mark_awaiting_stock'),
                $t('on_hold',            'Put On Hold',     true,  'put_on_hold'),
                $t('cancelled',          'Cancel',          true,  'cancel_order'),
            ],
            // ── Awaiting Stock: waiting for inventory ─────────────────────────────
            OrderStatus::AwaitingStock => [
                $t('in_progress',  'Resume',          false, 'initiate_order'),
                $t('new',          'Return to New',   false, 'return_to_new'),
                $t('on_hold',      'Put On Hold',     true,  'put_on_hold'),
                $t('cancelled',    'Cancel',          true,  'cancel_order'),
            ],
            // ── Ready for Dispatch: all preparation complete ──────────────────────
            OrderStatus::ReadyForDispatch => [
                $t('out_for_delivery', 'Dispatch',         false, 'dispatch'),
                $t('in_progress',      'Return to Queue',  false, 'return_to_processing'),
                $t('on_hold',          'Put On Hold',      true,  'put_on_hold'),
                $t('cancelled',        'Cancel',           true,  'cancel_order'),
            ],
            // ── On Hold: manual intervention ──────────────────────────────────────
            OrderStatus::OnHold => [
                $t('in_progress',     'Resume',          false, 'initiate_order'),
                $t('new',             'Reset to New',    false, 'return_to_new'),
                $t('awaiting_payment', 'Awaiting Payment', false, 'set_early_status'),
                $t('awaiting_stock',  'Awaiting Stock',  false, 'mark_awaiting_stock'),
                $t('cancelled',       'Cancel',          true,  'cancel_order'),
            ],
            // ── Cancelled: recoverable ────────────────────────────────────────────
            OrderStatus::Cancelled => [
                $t('new',             'Reactivate',      false, 'return_to_new'),
                $t('awaiting_payment', 'Awaiting Payment', false, 'set_early_status'),
            ],
            // ── Execution chain ───────────────────────────────────────────────────
            OrderStatus::OutForDelivery => [
                $t('delivered', 'Mark Delivered', false, 'complete_delivery'),
                $t('returned',  'Return',         true,  'return_order'),
            ],
            // ── Terminal ──────────────────────────────────────────────────────────
            OrderStatus::Delivered,
            OrderStatus::Returned => [],
        };
    }
}
