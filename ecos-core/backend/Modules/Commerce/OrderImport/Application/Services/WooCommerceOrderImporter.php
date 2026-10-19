<?php

declare(strict_types=1);

namespace Modules\Commerce\OrderImport\Application\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Modules\Admin\Configuration\Domain\Services\ConfigurationManager;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\OrderImport\Application\DTO\OrderImportResultDTO;
use Modules\Commerce\Orders\Application\Actions\ReserveOrderInventoryAction;
use Modules\Commerce\Orders\Domain\Contracts\OrderRepositoryInterface;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Shipping\Domain\Services\ShippingValidationService;
use Modules\Commerce\Synchronization\Application\Services\WooCommerceOrderStatusTranslator;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Logistics\Geography\Domain\Models\City;
use Modules\Logistics\Geography\Domain\Models\Governorate;
use Modules\Sales\Customers\Domain\Models\Customer;
use Throwable;

final class WooCommerceOrderImporter
{
    private const PER_PAGE = 100;

    private const TIMEOUT = 30;

    /** WooCommerce statuses that require inventory reservation on import. */
    private const RESERVE_ON_IMPORT = ['processing', 'on-hold'];

    public function __construct(
        private readonly OrderRepositoryInterface $orders,
        private readonly ReserveOrderInventoryAction $reserveInventory,
        private readonly ConfigurationManager $config,
        private readonly ShippingValidationService $shippingEngine,
        private readonly WooCommerceOrderStatusTranslator $statusTranslator,
    ) {}

    /**
     * Import (or skip if already exists) a single WooCommerce order payload.
     *
     * @param  array<string, mixed>  $wooOrder
     */
    public function importSingle(Channel $channel, array $wooOrder): bool
    {
        $externalId = (string) ($wooOrder['id'] ?? '');

        if ($externalId !== '' && $this->orderExists($externalId, (string) $channel->id)) {
            return false;
        }

        $policy = $this->resolveBrandPolicy($channel);
        [$customer] = $this->resolveCustomer($wooOrder, $policy);
        [$order, $lines, $fees, $coupons] = $this->buildOrder($wooOrder, $channel, $customer);

        if ($lines === []) {
            return false;
        }

        $linesSubtotal = array_sum(array_column($lines, 'line_total'));
        $order['subtotal'] = $linesSubtotal;
        $wooTotal = is_numeric($wooOrder['total'] ?? '') ? (float) $wooOrder['total'] : null;
        $order['total'] = $wooTotal ?? ($linesSubtotal + $order['shipping_total'] - $order['discount_total']);

        $createdOrder = $this->orders->create($order, $lines);

        if ($fees !== []) {
            $createdOrder->fees()->createMany($fees);
        }

        if ($coupons !== []) {
            $createdOrder->coupons()->createMany($coupons);
        }

        $wooStatus = (string) ($wooOrder['status'] ?? 'pending');

        if (in_array($wooStatus, self::RESERVE_ON_IMPORT, true)) {
            try {
                $this->reserveInventory->execute($createdOrder);
            } catch (Throwable) {
                // Non-fatal: order is saved; inventory failure is surfaced via logs.
            }
        }

        return true;
    }

    public function import(Channel $channel): OrderImportResultDTO
    {
        $credential = $channel->credential;

        if ($credential === null) {
            return new OrderImportResultDTO(0, 0, 0, 0, 0, 0, ['No credentials configured for this channel.']);
        }

        $importedOrders = 0;
        $createdCustomers = 0;
        $createdOrders = 0;
        $createdLines = 0;
        $skippedOrders = 0;
        $failedLines = 0;
        $errors = [];

        $policy = $this->resolveBrandPolicy($channel);
        $page = 1;
        $baseUrl = rtrim($channel->store_url, '/').'/wp-json/wc/v3/orders';

        while (true) {
            try {
                $response = Http::withBasicAuth($credential->consumer_key, $credential->consumer_secret)
                    ->timeout(self::TIMEOUT)
                    ->get($baseUrl, ['per_page' => self::PER_PAGE, 'page' => $page]);

                if (! $response->successful()) {
                    $errors[] = "Failed to fetch page {$page}: HTTP {$response->status()}.";
                    break;
                }

                /** @var list<array<string, mixed>> $wooOrders */
                $wooOrders = $response->json() ?? [];

                if (empty($wooOrders)) {
                    break;
                }

                foreach ($wooOrders as $wooOrder) {
                    $importedOrders++;
                    $externalId = (string) ($wooOrder['id'] ?? '');

                    if ($externalId !== '' && $this->orderExists($externalId, (string) $channel->id)) {
                        $skippedOrders++;
                        $importedOrders--;

                        continue;
                    }

                    try {
                        [$customer, $wasCreated] = $this->resolveCustomer($wooOrder, $policy);

                        if ($wasCreated) {
                            $createdCustomers++;
                        }

                        [$order, $lines, $fees, $coupons, $lineFails, $lineErrors] = $this->buildOrder(
                            $wooOrder,
                            $channel,
                            $customer,
                        );

                        $failedLines += $lineFails;
                        $errors = array_merge($errors, $lineErrors);

                        if ($lines !== []) {
                            $linesSubtotal = array_sum(array_column($lines, 'line_total'));
                            $order['subtotal'] = $linesSubtotal;

                            $wooTotal = is_numeric($wooOrder['total'] ?? '') ? (float) $wooOrder['total'] : null;
                            $order['total'] = $wooTotal ?? ($linesSubtotal + $order['shipping_total'] - $order['discount_total']);

                            $createdOrder = $this->orders->create($order, $lines);

                            if ($fees !== []) {
                                $createdOrder->fees()->createMany($fees);
                            }

                            if ($coupons !== []) {
                                $createdOrder->coupons()->createMany($coupons);
                            }

                            if (in_array($wooOrder['status'] ?? 'pending', self::RESERVE_ON_IMPORT, true)) {
                                try {
                                    $this->reserveInventory->execute($createdOrder);
                                } catch (Throwable $ie) {
                                    $errors[] = "Order #{$externalId} inventory reserve failed: {$ie->getMessage()}";
                                }
                            }

                            $createdOrders++;
                            $createdLines += count($lines);
                        } else {
                            $skippedOrders++;
                            $importedOrders--;
                            $errors[] = "Order #{$externalId} skipped: no valid line items.";
                        }
                    } catch (Throwable $e) {
                        $importedOrders--;
                        $errors[] = "Failed to import order #{$externalId}: {$e->getMessage()}";
                    }
                }

                $totalPages = max(1, (int) ($response->header('X-WP-TotalPages') ?: 1));

                if ($page >= $totalPages || count($wooOrders) < self::PER_PAGE) {
                    break;
                }

                $page++;
            } catch (Throwable $e) {
                $errors[] = "Request error on page {$page}: {$e->getMessage()}";
                break;
            }
        }

        return new OrderImportResultDTO(
            $importedOrders,
            $createdCustomers,
            $createdOrders,
            $createdLines,
            $skippedOrders,
            $failedLines,
            $errors,
        );
    }

    /** @return array<string, mixed> */
    private function resolveBrandPolicy(Channel $channel): array
    {
        if ($channel->brand_id === null) {
            return [];
        }

        return $this->config->getBrandPolicy((string) $channel->brand_id, 'order');
    }

    private function orderExists(string $externalId, string $channelId): bool
    {
        return Order::query()
            ->where('external_order_id', $externalId)
            ->where('channel_id', $channelId)
            ->exists();
    }

    /**
     * Normalize a phone number to E.164-like digits (no +).
     * Example: 01012345678 → 201012345678
     */
    private function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D/', '', $phone) ?? '';

        if ($digits === '') {
            return '';
        }

        if (str_starts_with($digits, '0') && strlen($digits) >= 10) {
            $digits = '2'.$digits;
        }

        return $digits;
    }

    /**
     * Find or create a customer from WooCommerce billing data.
     *
     * Applies customer_matching_policy from the brand's order policy (Phase 5):
     *   always_create_new — skip phone/email matching; always create a new customer record.
     *   all other values  — attempt phone then email match first (existing behaviour).
     *
     * @param  array<string, mixed>  $wooOrder
     * @param  array<string, mixed>  $policy  Brand order policy settings
     * @return array{Customer, bool}
     */
    private function resolveCustomer(array $wooOrder, array $policy = []): array
    {
        /** @var array<string, string> $billing */
        $billing = is_array($wooOrder['billing'] ?? null) ? $wooOrder['billing'] : [];

        $rawPhone = trim((string) ($billing['phone'] ?? ''));
        $email = trim((string) ($billing['email'] ?? ''));
        $normalizedPhone = $rawPhone !== '' ? $this->normalizePhone($rawPhone) : '';

        $matchingPolicy = (string) ($policy['customer_matching_policy'] ?? 'reuse_existing');

        if ($matchingPolicy !== 'always_create_new') {
            // 1. Match by phone
            if ($normalizedPhone !== '') {
                $customer = Customer::query()
                    ->where('phone', $normalizedPhone)
                    ->orWhere('mobile', $normalizedPhone)
                    ->first();

                if ($customer !== null) {
                    return [$customer, false];
                }
            }

            // 2. Match by email
            if ($email !== '') {
                $customer = Customer::query()->where('email', $email)->first();

                if ($customer !== null) {
                    return [$customer, false];
                }
            }
        }

        // 3. Create new customer
        $firstName = trim((string) ($billing['first_name'] ?? ''));
        $lastName = trim((string) ($billing['last_name'] ?? ''));
        $name = trim("{$firstName} {$lastName}");

        if ($name === '') {
            $name = $email !== '' ? $email : 'WooCommerce Customer';
        }

        // Suppress Eloquent events so CustomerObserver does not dispatch an outbound
        // CustomerSyncJob for a customer that originates FROM WooCommerce (circular sync).
        $customer = Customer::withoutEvents(function () use ($name, $email, $normalizedPhone, $billing): Customer {
            return Customer::query()->create([
                'code' => $this->nextCustomerCode(),
                'name' => $name,
                'email' => $email !== '' ? $email : null,
                'phone' => $normalizedPhone !== '' ? $normalizedPhone : null,
                'city' => trim((string) ($billing['city'] ?? '')) ?: null,
                'country' => trim((string) ($billing['country'] ?? '')) ?: null,
                'address' => trim((string) ($billing['address_1'] ?? '')) ?: null,
                'is_active' => true,
            ]);
        });

        return [$customer, true];
    }

    /**
     * Build the order attributes array, line items, fees, and coupons.
     *
     * @param  array<string, mixed>  $wooOrder
     * @return array{array<string, mixed>, list<array<string, mixed>>, list<array<string, mixed>>, list<array<string, mixed>>, int, list<string>}
     */
    private function buildOrder(array $wooOrder, Channel $channel, Customer $customer): array
    {
        $externalId = (string) ($wooOrder['id'] ?? '');
        $wooNumber = (string) ($wooOrder['number'] ?? $externalId);
        $wooStatus = (string) ($wooOrder['status'] ?? 'pending');
        // P5 fix: use the canonical WooCommerce → ECOS status translator (single source of truth).
        $status = $this->statusTranslator->translate($wooStatus)?->value ?? 'pending';

        $dateCreated = (string) ($wooOrder['date_created'] ?? '');
        $orderDate = $dateCreated !== '' ? substr($dateCreated, 0, 10) : now()->toDateString();

        $customerNote = trim((string) ($wooOrder['customer_note'] ?? ''));

        /** @var array<string, string> $billing */
        $billing = is_array($wooOrder['billing'] ?? null) ? $wooOrder['billing'] : [];
        /** @var array<string, string> $shipping */
        $shipping = is_array($wooOrder['shipping'] ?? null) ? $wooOrder['shipping'] : [];

        $shippingLines = is_array($wooOrder['shipping_lines'] ?? null) ? $wooOrder['shipping_lines'] : [];
        $shippingMethod = trim((string) ($shippingLines[0]['method_title'] ?? ''));

        $datePaid = trim((string) ($wooOrder['date_paid'] ?? ''));

        $taxTotal = is_numeric($wooOrder['total_tax'] ?? '') ? (float) $wooOrder['total_tax'] : 0;

        $billingFirstName = trim((string) ($billing['first_name'] ?? ''));
        $billingLastName = trim((string) ($billing['last_name'] ?? ''));
        $billingFullName = trim("{$billingFirstName} {$billingLastName}");

        $orderAttributes = [
            'channel_id' => (string) $channel->id,
            'assigned_warehouse_id' => null,
            'customer_id' => (string) $customer->id,
            // Customer snapshot — name as provided by WooCommerce at import time
            'customer_name' => $billingFullName !== '' ? $billingFullName : null,
            'external_order_id' => $externalId,
            'order_number' => $this->orders->nextOrderNumber(),
            'order_date' => $orderDate,
            'status' => OrderStatus::from($status)->value,
            'subtotal' => 0,
            'total' => 0,
            'shipping_total' => is_numeric($wooOrder['shipping_total'] ?? '') ? (float) $wooOrder['shipping_total'] : 0,
            'discount_total' => is_numeric($wooOrder['discount_total'] ?? '') ? (float) $wooOrder['discount_total'] : 0,
            'notes' => "Imported from WooCommerce order #{$wooNumber}.",
            'customer_note' => $customerNote !== '' ? $customerNote : null,
            'billing_first_name' => trim((string) ($billing['first_name'] ?? '')) ?: null,
            'billing_last_name' => trim((string) ($billing['last_name'] ?? '')) ?: null,
            'billing_company' => trim((string) ($billing['company'] ?? '')) ?: null,
            'billing_country' => trim((string) ($billing['country'] ?? '')) ?: null,
            'billing_state' => trim((string) ($billing['state'] ?? '')) ?: null,
            'billing_city' => trim((string) ($billing['city'] ?? '')) ?: null,
            'billing_address_1' => trim((string) ($billing['address_1'] ?? '')) ?: null,
            'billing_address_2' => trim((string) ($billing['address_2'] ?? '')) ?: null,
            'billing_postcode' => trim((string) ($billing['postcode'] ?? '')) ?: null,
            'billing_phone' => trim((string) ($billing['phone'] ?? '')) ?: null,
            'billing_email' => trim((string) ($billing['email'] ?? '')) ?: null,
            'shipping_first_name' => trim((string) ($shipping['first_name'] ?? '')) ?: null,
            'shipping_last_name' => trim((string) ($shipping['last_name'] ?? '')) ?: null,
            'shipping_company' => trim((string) ($shipping['company'] ?? '')) ?: null,
            'shipping_country' => trim((string) ($shipping['country'] ?? '')) ?: null,
            'shipping_state' => trim((string) ($shipping['state'] ?? '')) ?: null,
            'shipping_city' => trim((string) ($shipping['city'] ?? '')) ?: null,
            'shipping_address_1' => trim((string) ($shipping['address_1'] ?? '')) ?: null,
            'shipping_address_2' => trim((string) ($shipping['address_2'] ?? '')) ?: null,
            'shipping_postcode' => trim((string) ($shipping['postcode'] ?? '')) ?: null,
            'payment_method' => trim((string) ($wooOrder['payment_method'] ?? '')) ?: null,
            'payment_method_title' => trim((string) ($wooOrder['payment_method_title'] ?? '')) ?: null,
            'transaction_id' => trim((string) ($wooOrder['transaction_id'] ?? '')) ?: null,
            'date_paid' => $datePaid !== '' ? $datePaid : null,
            'shipping_method' => $shippingMethod !== '' ? $shippingMethod : null,
            'tax_total' => $taxTotal,
        ];

        /** @var list<array<string, mixed>> $rawLineItems */
        $rawLineItems = is_array($wooOrder['line_items'] ?? null) ? $wooOrder['line_items'] : [];

        $lines = [];
        $failedLines = 0;
        $lineErrors = [];

        foreach ($rawLineItems as $item) {
            $sku = trim((string) ($item['sku'] ?? ''));

            if ($sku === '') {
                $failedLines++;
                $lineErrors[] = "Order #{$externalId} line skipped: no SKU (product_id={$item['product_id']}).";

                continue;
            }

            $product = Product::query()->where('sku', $sku)->first();

            if ($product === null) {
                $failedLines++;
                $lineErrors[] = "Order #{$externalId} line skipped: SKU [{$sku}] not found in ECOS.";

                continue;
            }

            $quantity = (float) ($item['quantity'] ?? 1);
            $unitPrice = (float) ($item['price'] ?? 0);
            $lineTotal = (float) ($item['total'] ?? $quantity * $unitPrice);

            $lines[] = [
                'product_id' => (string) $product->id,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'line_total' => $lineTotal,
            ];
        }

        // Fee lines
        /** @var list<array<string, mixed>> $rawFeeLines */
        $rawFeeLines = is_array($wooOrder['fee_lines'] ?? null) ? $wooOrder['fee_lines'] : [];
        $fees = [];
        foreach ($rawFeeLines as $feeLine) {
            $feeName = trim((string) ($feeLine['name'] ?? ''));
            $feeTotal = is_numeric($feeLine['total'] ?? '') ? (float) $feeLine['total'] : 0;
            if ($feeName !== '') {
                $fees[] = ['name' => $feeName, 'total' => $feeTotal];
            }
        }

        // Coupon lines
        /** @var list<array<string, mixed>> $rawCouponLines */
        $rawCouponLines = is_array($wooOrder['coupon_lines'] ?? null) ? $wooOrder['coupon_lines'] : [];
        $coupons = [];
        foreach ($rawCouponLines as $couponLine) {
            $couponCode = trim((string) ($couponLine['code'] ?? ''));
            $couponDiscount = is_numeric($couponLine['discount'] ?? '') ? (float) $couponLine['discount'] : 0;
            if ($couponCode !== '') {
                $coupons[] = ['code' => $couponCode, 'discount' => $couponDiscount];
            }
        }

        // Shipping Engine validation — soft (never blocks import; sets to pending on rejection)
        if ($channel->brand_id !== null) {
            $statusOverride = $this->evaluateWooShipping(
                (string) $channel->brand_id,
                $shipping['state'] ?? $billing['state'] ?? '',
                $shipping['city'] ?? $billing['city'] ?? '',
                $externalId,
            );
            if ($statusOverride !== null) {
                $orderAttributes['status'] = $statusOverride;
            }
        }

        return [$orderAttributes, $lines, $fees, $coupons, $failedLines, $lineErrors];
    }

    /**
     * Attempt to resolve Egypt governorate/city from free-text WooCommerce fields,
     * then run the Shipping Engine. Returns a status override string or null.
     *
     * Import is NEVER blocked — on 'reject' we log and set the order to 'pending'
     * for human review. WooCommerce orders already exist; we must ingest them.
     */
    private function evaluateWooShipping(
        string $brandId,
        string $stateRaw,
        string $cityRaw,
        string $externalId,
    ): ?string {
        if ($stateRaw === '' && $cityRaw === '') {
            return null;
        }

        // Resolve governorate by name (English or Arabic)
        $governorate = Governorate::where('name_en', 'LIKE', "%{$stateRaw}%")
            ->orWhere('name_ar', 'LIKE', "%{$stateRaw}%")
            ->first();

        if ($governorate === null) {
            return null; // Cannot map — skip validation
        }

        // Resolve city by name or alias
        $city = null;
        if ($cityRaw !== '') {
            $city = City::where('governorate_id', $governorate->id)
                ->where(function ($q) use ($cityRaw): void {
                    $q->where('name_en', 'LIKE', "%{$cityRaw}%")
                        ->orWhere('name_ar', 'LIKE', "%{$cityRaw}%");
                })
                ->first();

            if ($city === null) {
                // Try aliases
                $city = City::whereHas('aliases', fn ($q) => $q->where('alias', 'LIKE', "%{$cityRaw}%"),
                )->where('governorate_id', $governorate->id)->first();
            }
        }

        $result = $this->shippingEngine->evaluate(
            brandId: $brandId,
            governorateId: $governorate->id,
            cityId: $city?->id,
            isDeliveryOrder: true,
        );

        if ($result->isAllowed()) {
            return null; // No override needed
        }

        // pending_review or reject → downgrade to pending for human triage
        Log::channel('daily')->info('[WooImport] Shipping validation issue', [
            'external_id' => $externalId,
            'brand_id' => $brandId,
            'governorate' => $stateRaw,
            'city' => $cityRaw,
            'decision' => $result->decision,
            'reason' => $result->reason,
        ]);

        return OrderStatus::NeedsShippingReview->value;
    }

    private function nextCustomerCode(): string
    {
        $last = Customer::query()
            ->withTrashed()
            ->where('code', 'like', 'CUS-%')
            ->orderByRaw("CAST(REPLACE(code, 'CUS-', '') AS UNSIGNED) DESC")
            ->value('code');

        if ($last === null) {
            return 'CUS-001';
        }

        $current = (int) str_replace('CUS-', '', (string) $last);

        return 'CUS-'.str_pad((string) ($current + 1), 3, '0', STR_PAD_LEFT);
    }
}
