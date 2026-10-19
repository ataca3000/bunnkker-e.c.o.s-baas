<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Modules\Admin\Configuration\Domain\Services\ConfigurationManager;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\Orders\Domain\Contracts\OrderRepositoryInterface;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Models\OrderEvent;
use Modules\Commerce\Shipping\Domain\Services\ShippingValidationService;
use Modules\Commerce\Shipping\Domain\ValueObjects\ShippingValidationResult;
use Modules\IAM\Domain\Contracts\PermissionServiceInterface;
use Modules\Operations\Fulfillment\Application\FulfillmentEngine;
use Modules\Operations\Fulfillment\Application\Workflows\ProcessOrderWorkflow;
use Modules\Operations\Preparation\Application\Services\BranchAssignmentEngine;
use Modules\Sales\Customers\Domain\Models\Customer;
use Modules\Sales\Customers\Domain\Models\CustomerAddress;
use Throwable;
use ValueError;

/**
 * Creates a manual order with optional inline customer creation.
 *
 * If customer_id is supplied the existing customer is used.
 * If customer data is supplied instead, a new customer + default address
 * are created atomically within the same transaction.
 */
final class CreateManualOrderAction extends BaseAction
{
    public function __construct(
        private readonly OrderRepositoryInterface $orders,
        private readonly ResolveProductPricingAction $pricingAction,
        private readonly PermissionServiceInterface $permissions,
        private readonly BranchAssignmentEngine $branchAssignment,
        private readonly ConfigurationManager $config,
        private readonly ReserveOrderInventoryAction $reserveInventory,
        private readonly ShippingValidationService $shippingEngine,
        private readonly FulfillmentEngine $fulfillmentEngine,
        private readonly ProcessOrderWorkflow $initiateWorkflow,
    ) {}

    /**
     * @param  array<string, mixed>  ...$arguments  [0] = validated request data
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        /** @var array<string, mixed> $data */
        $data = $arguments[0];

        // Resolve brand and order policy once — reused throughout this action.
        $brandId = $this->resolveBrandId($data['channel_id'] ?? null);
        $orderPolicy = $brandId !== null ? $this->config->getBrandPolicy($brandId, 'order') : [];

        // Enforce pricing constraints and discount limits.
        $this->enforceApprovedPricing($data);
        $this->enforceDiscountPolicy($data);

        // Validate shipping area through the Shipping Engine.
        // Walk-in POS (no governorate_id) returns walkIn() — no validation.
        $shippingResult = $this->validateAndResolveShipping($data, $brandId);
        /** @var ShippingValidationResult $shippingVO */
        $shippingVO = $shippingResult['result'];

        if ($shippingVO->isRejected()) {
            return OperationResult::failure(
                'Shipping area rejected: '.$shippingVO->reason.
                ' The destination is not supported by the brand shipping policy.',
            );
        }

        $customerWasReused = false;
        $subtotal = 0.0;
        $monetaryDiscount = 0.0;
        $grandTotal = 0.0;
        $remaining = 0.0;
        $order = DB::transaction(function () use ($data, $orderPolicy, $shippingResult, &$customerWasReused, &$subtotal, &$monetaryDiscount, &$grandTotal, &$remaining) {
            [$customerId, $customerWasReused] = $this->resolveCustomer($data, $orderPolicy);

            // Keep the customer's default delivery address in sync with the order data.
            // This runs for both new and existing customers so that the profile is always
            // up-to-date when searching the same customer in a subsequent order.
            $this->syncCustomerDefaultAddress($customerId, $data);

            // Load the resolved customer to supply fallback values for snapshot fields.
            // When an existing customer is matched by phone the form may not pre-fill
            // secondary_phone or notes, so we fall back to the customer record's current
            // values to ensure the snapshot is complete at creation time.
            $customerRecord = Customer::find($customerId);

            $subtotal = array_sum(
                array_map(
                    static fn (array $l): float => (float) $l['quantity'] * (float) $l['unit_price'],
                    $data['lines'] ?? [],
                ),
            );

            // discount_amount in the request is the raw input (10 for "10%", or 150 for "EGP 150 fixed").
            // Convert to monetary amount before computing grand_total — same logic as OrderResource.
            $rawDiscount = (float) ($data['discount_amount'] ?? 0);
            $discountType = (string) ($data['discount_type'] ?? '');
            $monetaryDiscount = $discountType === 'percentage'
                ? round($subtotal * $rawDiscount / 100, 2)
                : $rawDiscount;
            $shippingCost = (float) ($data['shipping_cost'] ?? 0);
            $depositAmount = (float) ($data['deposit_amount'] ?? 0);
            $grandTotal = round($subtotal - $monetaryDiscount + $shippingCost, 2);
            $remaining = max(0.0, round($grandTotal - $depositAmount, 2));

            // Always derive company from the authenticated actor — never trust the
            // request body. This closes the cross-tenant order-creation vector.
            $actorCompanyId = Auth::user()?->company_id;

            $orderAttributes = [
                'company_id' => $actorCompanyId,
                'channel_id' => $data['channel_id'] ?? null,
                'customer_id' => $customerId,
                'order_number' => $this->orders->nextOrderNumber(),
                'order_date' => $data['order_date'] ?? now()->toDateString(),
                'status' => $shippingResult['status_override'] ?? $this->resolveManualOrderStatus($data, $orderPolicy),
                'subtotal' => $subtotal,
                'total' => $grandTotal,
                'notes' => $data['notes'] ?? null,
                'requested_delivery_date' => $data['requested_delivery_date'] ?? null,
                'preferred_delivery_time' => $data['preferred_delivery_time'] ?? null,
                'delivery_window_id' => $data['delivery_window_id'] ?? null,
                'delivery_window' => $data['delivery_window'] ?? null,
                'delivery_zone_id' => $data['delivery_zone_id'] ?? null,
                'delivery_zone' => $data['delivery_zone'] ?? null,
                'payment_method_manual' => $data['payment_method_manual'] ?? null,
                'payment_proof_path' => $data['payment_proof_path'] ?? null,
                'governorate' => $data['governorate'] ?? null,
                'city' => $data['city'] ?? null,
                'shipping_address' => $data['shipping_address'] ?? null,
                'building' => $data['building'] ?? null,
                'floor' => $data['floor'] ?? null,
                'apartment' => $data['apartment'] ?? null,
                'landmark' => $data['landmark'] ?? null,
                'address_notes' => $data['address_notes'] ?? null,
                'area' => $data['area'] ?? null,
                'google_maps_lat' => $data['google_maps_lat'] ?? null,
                'google_maps_lng' => $data['google_maps_lng'] ?? null,
                'google_maps_url' => $data['google_maps_url'] ?? null,
                'location_source' => $data['location_source'] ?? null,
                // Customer snapshot — historically immutable once written.
                // Form data takes precedence; customer record provides fallback for
                // fields not pre-filled when an existing customer is matched by phone.
                'created_by_id' => Auth::id() !== null ? (string) Auth::id() : null,
                'created_by_name' => Auth::user()?->name ?? null,
                'status_entered_at' => now(),
                'customer_name' => $data['customer_name'] ?? $customerRecord?->name,
                'customer_secondary_phone' => ($data['customer_secondary_phone'] ?? null) ?: $customerRecord?->mobile,
                'customer_notes' => ($data['customer_notes'] ?? null) ?: $customerRecord?->notes,
                'billing_phone' => $data['customer_phone'] ?? null,
                'shipping_cost' => $shippingCost ?: null,
                'shipping_cost_source' => $data['shipping_cost_source'] ?? null,
                'discount_amount' => $rawDiscount,
                'discount_type' => $data['discount_type'] ?? null,
                'deposit_amount' => $depositAmount,
                'remaining_balance' => $remaining,
            ];

            $lines = array_map(static fn (array $l): array => [
                'product_id' => (string) $l['product_id'],
                'quantity' => (float) $l['quantity'],
                'unit_price' => (float) $l['unit_price'],
                'line_total' => (float) $l['quantity'] * (float) $l['unit_price'],
            ], $data['lines'] ?? []);

            return $this->orders->create($orderAttributes, $lines);
        });

        $order->load(['customer', 'lines.product.unit', 'fees', 'coupons', 'channel']);

        // TASK-BRANCH-ASSIGNMENT-ENGINE-001: Resolve branch → warehouse via coverage rules.
        $this->branchAssignment->assign($order, Auth::user()?->company_id ?? $order->channel?->brand?->company_id);

        // V3 auto-trigger: immediately initiate the FulfillmentEngine for all New orders.
        // Scheduled orders wait for their delivery date; AwaitingPayment orders wait for payment.
        // The engine attempts reservation and moves the order to InProgress (or AwaitingStock).
        if ($order->status === OrderStatus::NewOrder) {
            try {
                $actorId = Auth::id() !== null ? (string) Auth::id() : null;
                $this->fulfillmentEngine->run(
                    $this->initiateWorkflow,
                    $order->fresh(),
                    [],
                    $actorId,
                );
            } catch (Throwable $e) {
                Log::channel('daily')->warning('[Order] Auto-initiate fulfillment failed after creation', [
                    'order_id' => $order->id,
                    'error'    => $e->getMessage(),
                ]);
            }
        }

        $this->logAuditEvents($order->id, $data, $order->status->value, $customerWasReused, $order, [
            'subtotal' => $subtotal,
            'monetary_discount' => $monetaryDiscount,
            'grand_total' => $grandTotal,
            'remaining' => $remaining,
        ]);

        return OperationResult::success($order, 'Order created successfully.');
    }

    /** Resolves the brand_id from the sales channel, or null if no channel is set. */
    private function resolveBrandId(?string $channelId): ?string
    {
        if (! $channelId) {
            return null;
        }

        return Channel::query()->where('id', $channelId)->value('brand_id');
    }

    /**
     * Status migration map for legacy config values (pre-V3).
     * Brand policy JSON may still reference old status strings — map to current values.
     */
    private const LEGACY_STATUS_MAP = [
        'pending'    => 'new',
        'processing' => 'in_progress',
        'confirmed'  => 'in_progress',
        'preparing'  => 'in_progress',
        'review'     => 'on_hold',
        'rescheduled' => 'on_hold',
        'completed'  => 'delivered',
    ];

    /**
     * Statuses preferred when payment is confirmed — ordered by business priority.
     * Payment-clear orders prefer In Progress to enter the operational queue directly.
     */
    private const PAYMENT_CLEAR_STATUS_PREFERENCE = ['in_progress', 'new'];

    /**
     * Determines the entry status for a manually created order.
     *
     * Priority:
     *   1. Proof required but not supplied → AwaitingPayment
     *   2. Frontend-submitted status is within the policy-allowed set → use it
     *   3. Payment method present + multi-select policy → prefer highest-confidence
     *      enabled status (processing > confirmed > preparing > first valid)
     *   4. No payment method + multi-select policy → first valid enabled status
     *   5. Single-string policy → that status
     *   6. Default → Pending
     */
    private function resolveManualOrderStatus(array $data, array $orderPolicy): string
    {
        $method = (string) ($data['payment_method_manual'] ?? '');
        $submittedStatus = (string) ($data['status'] ?? '');

        // Proof required but not supplied → AwaitingPayment regardless of selection.
        if ($method !== '') {
            $proofPolicy = $orderPolicy['payment_proof_policy'] ?? [];
            $requirement = (string) ($proofPolicy[$method] ?? 'none');
            if ($requirement === 'required' && empty($data['payment_proof_path'])) {
                return OrderStatus::AwaitingPayment->value;
            }
        }

        // Future delivery date → Scheduled so the order waits until its date arrives.
        $deliveryDate = (string) ($data['requested_delivery_date'] ?? '');
        if ($deliveryDate !== '' && $deliveryDate > now()->toDateString()) {
            return OrderStatus::Scheduled->value;
        }

        $configured = $orderPolicy['source_entry_policies']['manual'] ?? null;

        if (is_array($configured)) {
            // Build the set of enabled, valid statuses (preserving config order).
            // Legacy pre-V3 values (pending, processing, confirmed) are migrated on read.
            $enabled = [];
            foreach ($configured as $status) {
                try {
                    $migrated = self::LEGACY_STATUS_MAP[(string) $status] ?? (string) $status;
                    $enabled[] = OrderStatus::from($migrated)->value;
                } catch (ValueError) { /* skip invalid */
                }
            }
            $enabled = array_values(array_unique($enabled));

            if (empty($enabled)) {
                return OrderStatus::NewOrder->value;
            }

            // Honor explicit frontend selection when it is within the allowed set.
            if ($submittedStatus !== '' && in_array($submittedStatus, $enabled, true)) {
                return $submittedStatus;
            }

            // Auto-selection fallback: prefer higher-confidence for payment-clear orders.
            if ($method !== '') {
                $enabledSet = array_flip($enabled);
                foreach (self::PAYMENT_CLEAR_STATUS_PREFERENCE as $preferred) {
                    if (isset($enabledSet[$preferred])) {
                        return $preferred;
                    }
                }
            }

            return $enabled[0];
        }

        // Single string (legacy) — only one valid status exists.
        if (is_string($configured) && $configured !== '') {
            try {
                $migrated = self::LEGACY_STATUS_MAP[$configured] ?? $configured;
                return OrderStatus::from($migrated)->value;
            } catch (ValueError) { /* fall through */
            }
        }

        return OrderStatus::NewOrder->value;
    }

    /**
     * Validates that each line's submitted unit_price matches the product's
     * current approved selling price. Allows deviation only when the actor
     * holds the `sales.orders.override_price` permission.
     *
     * Products with no approved price set (both regular_price and sale_price
     * are null) are skipped — those products haven't been priced yet and
     * blocking the order would be more disruptive than helpful.
     *
     * @param  array<string, mixed>  $data
     *
     * @throws AuthorizationException
     */
    private function enforceApprovedPricing(array $data): void
    {
        $user = Auth::user();
        $companyId = $user?->company_id;

        // System roles (super-admin) bypass all permission checks.
        $isSystemUser = $user !== null && $this->permissions->userHasSystemRole($user);
        $canOverride = $isSystemUser
            || ($user !== null && $this->permissions->userHasPermission($user, 'sales.orders.override_price'));

        foreach ($data['lines'] ?? [] as $line) {
            $productId = (string) ($line['product_id'] ?? '');
            $submittedPrice = (float) ($line['unit_price'] ?? 0);

            $pricing = $this->pricingAction->execute($productId, $companyId);

            // No approved price set — skip enforcement.
            if ($pricing['resolved_price'] === null) {
                continue;
            }

            $approvedPrice = (float) $pricing['resolved_price'];

            // Allow a rounding tolerance of ±0.005 (half-cent).
            if (abs($submittedPrice - $approvedPrice) <= 0.005) {
                continue;
            }

            if (! $canOverride) {
                throw new AuthorizationException(
                    "Price override is not permitted. Product approved price is {$approvedPrice}. ".
                    'The `sales.orders.override_price` permission is required to submit a different price.',
                );
            }

            // Override is allowed — will be logged in logAuditEvents.
        }
    }

    /**
     * Validates that the submitted discount_amount does not exceed the brand's
     * configured discount limit. Requires `sales.orders.override_discount` permission
     * to bypass, or system role.
     *
     * @param  array<string, mixed>  $data
     *
     * @throws AuthorizationException
     */
    private function enforceDiscountPolicy(array $data): void
    {
        $discountAmount = (float) ($data['discount_amount'] ?? 0);
        if ($discountAmount <= 0.0) {
            return;
        }

        $channelId = $data['channel_id'] ?? null;
        if (! $channelId) {
            return;
        }

        $channel = Channel::find($channelId);
        if (! $channel) {
            return;
        }

        $policy = $this->config->getBrandPolicy((string) $channel->brand_id, 'pricing');
        $discountType = (string) ($policy['discount_type'] ?? 'percentage');
        $discountValue = (float) ($policy['discount_value'] ?? 0);

        if ($discountValue <= 0) {
            return; // No limit configured — skip enforcement
        }

        $subtotal = array_sum(
            array_map(
                static fn (array $l): float => (float) $l['quantity'] * (float) $l['unit_price'],
                $data['lines'] ?? [],
            ),
        );

        $maxDiscount = $discountType === 'percentage'
            ? $subtotal * ($discountValue / 100)
            : $discountValue;

        if ($discountAmount <= $maxDiscount + 0.005) {
            return; // Within limit
        }

        $user = Auth::user();
        $isSystemUser = $user !== null && $this->permissions->userHasSystemRole($user);
        $canOverride = $isSystemUser
            || ($user !== null && $this->permissions->userHasPermission($user, 'sales.orders.override_discount'));

        if (! $canOverride) {
            $limit = $discountType === 'percentage'
                ? "{$discountValue}% of subtotal (max ".number_format($maxDiscount, 2).' EGP)'
                : number_format($discountValue, 2).' EGP';

            throw new AuthorizationException(
                "Discount of {$discountAmount} EGP exceeds the configured limit of {$limit}. ".
                'The `sales.orders.override_discount` permission is required to proceed.',
            );
        }
    }

    private function logAuditEvents(
        string $orderId,
        array $data,
        string $orderStatus = '',
        bool $customerWasReused = false,
        ?\Modules\Commerce\Orders\Domain\Models\Order $order = null,
        array $financials = [],
    ): void {
        $actorId = Auth::id() !== null ? (string) Auth::id() : null;
        $actorName = Auth::user()?->name;
        $actorRole = Auth::user()?->roles()->value('name');

        OrderEvent::log(
            $orderId,
            'order_created',
            'Manual order created.',
            [],
            $actorId,
            $actorName,
            null,
            null,
            'orders',
            'user',
            'dashboard',
            'created',
            null,
            null,
            null,
            null,
            [
                'channel' => $order?->channel?->name,
                'customer_name' => $data['customer_name'] ?? null,
                'order_total' => $order?->total,
            ],
            $actorRole,
        );

        if ($orderStatus === OrderStatus::AwaitingPayment->value) {
            OrderEvent::log($orderId, 'awaiting_payment', 'Order created with payment proof pending.', [
                'payment_method' => $data['payment_method_manual'] ?? null,
            ], $actorId);
        }

        if (empty($data['customer_id'])) {
            if ($customerWasReused) {
                OrderEvent::log($orderId, 'customer_reused', 'Existing customer matched by phone.', [
                    'phone' => $data['customer_phone'] ?? null,
                ], $actorId);
            } elseif (! empty($data['customer_name'])) {
                OrderEvent::log($orderId, 'customer_created', 'New customer created during order.', [
                    'name' => $data['customer_name'],
                    'phone' => $data['customer_phone'] ?? null,
                ], $actorId);
            }
        }

        if (! empty($data['discount_amount']) && (float) $data['discount_amount'] > 0) {
            OrderEvent::log(
                $orderId,
                'discount_applied',
                'Discount applied to order.',
                [],
                $actorId,
                $actorName,
                null,
                null,
                'orders',
                'user',
                'dashboard',
                'payment',
                null,
                null,
                null,
                null,
                [
                    'amount' => $data['discount_amount'],
                    'type' => $data['discount_type'] ?? 'fixed',
                    'calculated_value' => $financials['monetary_discount'] ?? null,
                    'subtotal' => $financials['subtotal'] ?? null,
                ],
                $actorRole,
                Auth::user()?->email,
            );
        }

        if (! empty($data['deposit_amount']) && (float) $data['deposit_amount'] > 0) {
            $depositAmt = (float) $data['deposit_amount'];
            $grandTotal = (float) ($financials['grand_total'] ?? 0);
            $remaining = (float) ($financials['remaining'] ?? max(0, $grandTotal - $depositAmt));

            OrderEvent::log(
                $orderId,
                'deposit_recorded',
                'Deposit recorded on order.',
                [],
                $actorId,
                $actorName,
                ['deposit_amount' => 0, 'remaining_balance' => $grandTotal],
                ['deposit_amount' => $depositAmt, 'remaining_balance' => $remaining],
                'orders',
                'user',
                'dashboard',
                'payment',
                null,
                null,
                null,
                null,
                [
                    'grand_total' => $grandTotal,
                ],
                $actorRole,
                Auth::user()?->email,
            );
        }

        if (! empty($data['payment_proof_path'])) {
            OrderEvent::log($orderId, 'proof_uploaded', 'Payment proof attached.', [
                'path' => $data['payment_proof_path'],
                'method' => $data['payment_method_manual'] ?? null,
            ], $actorId);
        }

        if (($data['shipping_cost_source'] ?? null) === 'override') {
            OrderEvent::log($orderId, 'shipping_override', 'Shipping cost manually overridden.', [
                'cost' => $data['shipping_cost'] ?? null,
            ], $actorId);
        }

        if (! empty($data['requested_delivery_date'])) {
            OrderEvent::log($orderId, 'delivery_date_set', 'Requested delivery date recorded.', [
                'date' => $data['requested_delivery_date'],
            ], $actorId);
        }

        if (! empty($data['google_maps_lat']) && ! empty($data['google_maps_lng'])) {
            OrderEvent::log($orderId, 'location_set', 'Customer location coordinates recorded.', [
                'lat' => $data['google_maps_lat'],
                'lng' => $data['google_maps_lng'],
                'source' => $data['location_source'] ?? null,
            ], $actorId);
        }
    }

    /**
     * Returns [customerId, wasReused] — the customer ID to attach to the order and whether
     * an existing customer was matched by phone (vs. a new one being created).
     *
     * Customer Matching Policy values (Phase 4):
     *   reuse_existing    — phone match → silently reuse (recommended default)
     *   warn_only         — phone match → reuse; frontend may show a warning
     *   block_new_customer — phone match → must reuse (same backend behaviour as reuse_existing)
     *   always_create_new — skip phone lookup; always create a new customer record
     *
     * Orders must NEVER be rejected because a customer already exists.
     *
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $orderPolicy
     * @return array{string, bool}
     */
    private function resolveCustomer(array $data, array $orderPolicy = []): array
    {
        if (! empty($data['customer_id'])) {
            return [(string) $data['customer_id'], false];
        }

        $phone = (string) ($data['customer_phone'] ?? '');
        $policy = (string) ($orderPolicy['customer_matching_policy'] ?? 'reuse_existing');

        // Phone-based matching applies for all policies except always_create_new.
        if ($policy !== 'always_create_new' && $phone !== '') {
            $existing = Customer::where('phone', $phone)->orWhere('mobile', $phone)->first();
            if ($existing !== null) {
                return [$existing->id, true];
            }
        }

        // Create a new customer record.
        // Use MAX of the numeric suffix to avoid collision when records are inserted out of sequence.
        $maxNum = (int) \DB::table('customers')
            ->selectRaw("COALESCE(MAX(CAST(SUBSTRING_INDEX(code, '-', -1) AS UNSIGNED)), 0) as n")
            ->value('n');
        $code = 'CUS-'.str_pad((string) ($maxNum + 1), 5, '0', STR_PAD_LEFT);

        $customer = Customer::create([
            'code' => $code,
            'name' => (string) $data['customer_name'],
            'phone' => $data['customer_phone'] ?? null,
            'mobile' => $data['customer_secondary_phone'] ?? null,
            'city' => $data['city'] ?? null,
            'governorate' => $data['governorate'] ?? null,
            'area' => $data['area'] ?? null,
            'address' => $data['shipping_address'] ?? null,
            'notes' => $data['customer_notes'] ?? null,
            'is_active' => true,
        ]);

        // CustomerAddress is created by syncCustomerDefaultAddress after resolveCustomer returns.
        return [$customer->id, false];
    }

    /**
     * Upserts the customer's default delivery address with the non-null fields
     * supplied by the order form. Runs for both new and existing customers so the
     * customer profile always reflects the most recent known delivery details.
     *
     * Null values are intentionally skipped — they must not overwrite existing data
     * when the current order form didn't include every address field.
     *
     * @param  array<string, mixed>  $data
     */
    private function syncCustomerDefaultAddress(string $customerId, array $data): void
    {
        $governorate = $data['governorate'] ?? null;
        $city = $data['city'] ?? null;

        if ($governorate === null && $city === null) {
            return;
        }

        $fields = [
            'governorate' => $governorate,
            'city' => $city,
            'area' => $data['area'] ?? null,
            'address_line' => $data['shipping_address'] ?? null,
            'building' => $data['building'] ?? null,
            'floor' => $data['floor'] ?? null,
            'apartment' => $data['apartment'] ?? null,
            'landmark' => $data['landmark'] ?? null,
            'address_notes' => $data['address_notes'] ?? null,
            'google_maps_lat' => $data['google_maps_lat'] ?? null,
            'google_maps_lng' => $data['google_maps_lng'] ?? null,
            'google_maps_url' => $data['google_maps_url'] ?? null,
            'location_source' => $data['location_source'] ?? null,
        ];

        // Only send non-null values so we never blank out fields not present in this request.
        $updates = array_filter($fields, static fn ($v) => $v !== null);

        if (empty($updates)) {
            return;
        }

        $existing = CustomerAddress::where('customer_id', $customerId)
            ->where('is_default', true)
            ->first();

        if ($existing !== null) {
            $existing->update($updates);
        } else {
            CustomerAddress::create(array_merge($updates, [
                'customer_id' => $customerId,
                'label' => 'Default',
                'is_default' => true,
            ]));
        }

        // Persist customer-level notes when the order form provided them.
        if (! empty($data['customer_notes'])) {
            Customer::where('id', $customerId)->update(['notes' => $data['customer_notes']]);
        }
    }

    /**
     * Runs the Shipping Engine and converts the result into order-creation overrides.
     *
     * No exceptions. Walk-in (no governorate_id) returns an empty override array.
     * Rejected orders return a structured failure so the caller can surface a
     * human-readable API error rather than a 500.
     *
     * @param  array<string, mixed>  $data
     * @return array{result: ShippingValidationResult, status_override?: string}
     */
    private function validateAndResolveShipping(array $data, ?string $brandId): array
    {
        $governorateId = isset($data['governorate_id']) ? (int) $data['governorate_id'] : null;
        $cityId = isset($data['city_id']) ? (int) $data['city_id'] : null;
        $isDelivery = $governorateId !== null;

        if ($brandId === null || ! $isDelivery) {
            return ['result' => ShippingValidationResult::walkIn()];
        }

        $result = $this->shippingEngine->evaluate(
            brandId: $brandId,
            governorateId: $governorateId,
            cityId: $cityId,
            isDeliveryOrder: true,
        );

        $override = ['result' => $result];

        if ($result->requiresReview()) {
            $override['status_override'] = OrderStatus::OnHold->value;
        }

        return $override;
    }
}
