<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Infrastructure\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Modules\Commerce\Orders\Domain\Contracts\OrderRepositoryInterface;
use Modules\Commerce\Orders\Domain\Models\Order;

final class EloquentOrderRepository implements OrderRepositoryInterface
{
    private const SORTABLE = ['order_number', 'order_date', 'status', 'total', 'created_at'];

    private const WITH = ['channel', 'customer', 'lines.product.unit'];

    private const WITH_DETAIL = ['channel', 'customer', 'lines.product.unit', 'fees', 'coupons', 'orderNotes'];

    public function paginate(array $filters): LengthAwarePaginator
    {
        $query = Order::query()->with(self::WITH);

        $companyId = trim((string) ($filters['company_id'] ?? ''));
        if ($companyId !== '') {
            $query->where('company_id', $companyId);
        }

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $query->where(function (Builder $builder) use ($search): void {
                $builder
                    ->where('order_number', 'like', "%{$search}%")
                    ->orWhere('customer_name', 'like', "%{$search}%")
                    ->orWhere('billing_phone', 'like', "%{$search}%")
                    ->orWhere('customer_secondary_phone', 'like', "%{$search}%")
                    ->orWhere('tracking_number', 'like', "%{$search}%")
                    ->orWhere('external_order_id', 'like', "%{$search}%")
                    ->orWhereHas('customer', function (Builder $c) use ($search): void {
                        $c->where('name', 'like', "%{$search}%")
                            ->orWhere('phone', 'like', "%{$search}%")
                            ->orWhere('code', 'like', "%{$search}%");
                    })
                    ->orWhereHas('lines.product', function (Builder $p) use ($search): void {
                        $p->where('sku', 'like', "%{$search}%")
                            ->orWhere('name', 'like', "%{$search}%");
                    });
            });
        }

        $status = trim((string) ($filters['status'] ?? ''));
        if ($status !== '' && $status !== 'all') {
            $query->where('status', $status);
        }

        $channelId = trim((string) ($filters['channel_id'] ?? ''));
        if ($channelId !== '') {
            $query->where('channel_id', $channelId);
        }

        $customerId = trim((string) ($filters['customer_id'] ?? ''));
        if ($customerId !== '') {
            $query->where('customer_id', $customerId);
        }

        // Product filter — orders containing the specified product
        $productId = trim((string) ($filters['product_id'] ?? ''));
        if ($productId !== '') {
            $query->whereHas('lines', function (Builder $b) use ($productId): void {
                $b->where('product_id', $productId);
            });
        }

        // Geographic filters
        $governorate = trim((string) ($filters['governorate'] ?? ''));
        if ($governorate !== '') {
            $query->where('governorate', 'like', "%{$governorate}%");
        }

        $city = trim((string) ($filters['city'] ?? ''));
        if ($city !== '') {
            $query->where('city', 'like', "%{$city}%");
        }

        // Payment method filter
        $paymentMethod = trim((string) ($filters['payment_method'] ?? ''));
        if ($paymentMethod !== '') {
            $query->where(function (Builder $b) use ($paymentMethod): void {
                $b->where('payment_method', $paymentMethod)
                    ->orWhere('payment_method_manual', $paymentMethod);
            });
        }

        // Shipping company filter (stored in shipping_method for WooCommerce imports)
        $shippingCompany = trim((string) ($filters['shipping_company'] ?? ''));
        if ($shippingCompany !== '') {
            $query->where('shipping_method', $shippingCompany);
        }

        // Date range filter on order_date
        $dateFrom = trim((string) ($filters['date_from'] ?? ''));
        if ($dateFrom !== '') {
            $query->whereDate('order_date', '>=', $dateFrom);
        }

        $dateTo = trim((string) ($filters['date_to'] ?? ''));
        if ($dateTo !== '') {
            $query->whereDate('order_date', '<=', $dateTo);
        }

        // Location filter
        $hasLocation = $filters['has_location'] ?? null;
        if ($hasLocation !== null && $hasLocation !== '') {
            $loc = filter_var($hasLocation, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($loc === true) {
                $query->whereNotNull('google_maps_lat');
            } elseif ($loc === false) {
                $query->whereNull('google_maps_lat');
            }
        }

        // Customer code (exact match)
        $customerCode = trim((string) ($filters['customer_code'] ?? ''));
        if ($customerCode !== '') {
            $query->whereHas('customer', function (Builder $b) use ($customerCode): void {
                $b->where('code', $customerCode);
            });
        }

        // Phone — order snapshot phone or secondary phone
        $phone = trim((string) ($filters['phone'] ?? ''));
        if ($phone !== '') {
            $query->where(function (Builder $b) use ($phone): void {
                $b->where('billing_phone', 'like', "%{$phone}%")
                    ->orWhere('customer_secondary_phone', 'like', "%{$phone}%");
            });
        }

        // External order number (WooCommerce / marketplace order ID)
        $externalNumber = trim((string) ($filters['external_number'] ?? ''));
        if ($externalNumber !== '') {
            $query->where('external_order_id', 'like', "%{$externalNumber}%");
        }

        // Brand filter — resolve through the channel relationship
        $brandId = trim((string) ($filters['brand_id'] ?? ''));
        if ($brandId !== '') {
            $query->whereHas('channel', function (Builder $b) use ($brandId): void {
                $b->where('brand_id', $brandId);
            });
        }

        // SKU filter — any line item containing the specified SKU
        $sku = trim((string) ($filters['sku'] ?? ''));
        if ($sku !== '') {
            $query->whereHas('lines.product', function (Builder $b) use ($sku): void {
                $b->where('sku', 'like', "%{$sku}%");
            });
        }

        // Payment status: paid = deposit_amount >= total; partial = 0 < deposit < total; unpaid = 0
        $paymentStatus = trim((string) ($filters['payment_status'] ?? ''));
        if (in_array($paymentStatus, ['paid', 'partial', 'unpaid'], true)) {
            if ($paymentStatus === 'paid') {
                $query->whereColumn('deposit_amount', '>=', 'total');
            } elseif ($paymentStatus === 'partial') {
                $query->where('deposit_amount', '>', 0)
                    ->whereColumn('deposit_amount', '<', 'total');
            } elseif ($paymentStatus === 'unpaid') {
                $query->where(function (Builder $b): void {
                    $b->whereNull('deposit_amount')
                        ->orWhere('deposit_amount', '<=', 0);
                });
            }
        }

        // Has payment proof
        $hasProof = $filters['has_payment_proof'] ?? null;
        if ($hasProof !== null && $hasProof !== '') {
            $boolProof = filter_var($hasProof, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($boolProof === true) {
                $query->whereNotNull('payment_proof_path')
                    ->where('payment_proof_path', '!=', '');
            } elseif ($boolProof === false) {
                $query->where(function (Builder $b): void {
                    $b->whereNull('payment_proof_path')
                        ->orWhere('payment_proof_path', '');
                });
            }
        }

        // Reservation status
        $reservationStatus = trim((string) ($filters['reservation_status'] ?? ''));
        if ($reservationStatus !== '') {
            if ($reservationStatus === 'reserved') {
                $query->whereNotNull('inventory_reserved_at');
            } elseif ($reservationStatus === 'not_reserved') {
                $query->whereNull('inventory_reserved_at');
            }
        }

        // Delivery zone
        $zone = trim((string) ($filters['zone'] ?? ''));
        if ($zone !== '') {
            $query->where(function (Builder $b) use ($zone): void {
                $b->where('delivery_zone', 'like', "%{$zone}%")
                    ->orWhere('delivery_zone_id', $zone);
            });
        }

        // Amount range filter (uses grand_total = total column)
        $minAmount = $filters['min_amount'];
        if ($minAmount !== null && $minAmount !== '') {
            $query->where('total', '>=', (float) $minAmount);
        }

        $maxAmount = $filters['max_amount'];
        if ($maxAmount !== null && $maxAmount !== '') {
            $query->where('total', '<=', (float) $maxAmount);
        }

        // Created by (staff member name or ID)
        $createdBy = trim((string) ($filters['created_by'] ?? ''));
        if ($createdBy !== '') {
            $query->where(function (Builder $b) use ($createdBy): void {
                $b->where('created_by_id', $createdBy)
                    ->orWhere('created_by_name', 'like', "%{$createdBy}%");
            });
        }

        // Customer intelligence filter — comma-separated keys, applied as OR
        $customerFilter = trim((string) ($filters['customer_filter'] ?? ''));
        if ($customerFilter !== '') {
            $keys = array_filter(array_map('trim', explode(',', $customerFilter)));
            if (! empty($keys)) {
                $query->where(function (Builder $outer) use ($keys): void {
                    foreach ($keys as $key) {
                        $this->applyCustomerIntelligenceFilter($outer, $key);
                    }
                });
            }
        }

        $sortBy = (string) ($filters['sort_by'] ?? 'created_at');
        if (! in_array($sortBy, self::SORTABLE, true)) {
            $sortBy = 'created_at';
        }

        $sortDir = strtolower((string) ($filters['sort_dir'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';
        $perPage = max(1, min((int) ($filters['per_page'] ?? 10), 100));

        return $query->orderBy($sortBy, $sortDir)->paginate($perPage);
    }

    private function applyCustomerIntelligenceFilter(Builder $query, string $key): void
    {
        switch ($key) {
            case 'first_order':
                $query->orWhereIn('customer_id', function ($sub): void {
                    $sub->select('customer_id')
                        ->from('orders')
                        ->whereNull('deleted_at')
                        ->groupBy('customer_id')
                        ->havingRaw('COUNT(*) = 1');
                });
                break;

            case 'repeated':
                $query->orWhereIn('customer_id', function ($sub): void {
                    $sub->select('customer_id')
                        ->from('orders')
                        ->whereNull('deleted_at')
                        ->groupBy('customer_id')
                        ->havingRaw('COUNT(*) >= 2');
                });
                break;

            case 'more_than_5':
                $query->orWhereIn('customer_id', function ($sub): void {
                    $sub->select('customer_id')
                        ->from('orders')
                        ->whereNull('deleted_at')
                        ->groupBy('customer_id')
                        ->havingRaw('COUNT(*) > 5');
                });
                break;

            case 'more_than_10':
                $query->orWhereIn('customer_id', function ($sub): void {
                    $sub->select('customer_id')
                        ->from('orders')
                        ->whereNull('deleted_at')
                        ->groupBy('customer_id')
                        ->havingRaw('COUNT(*) > 10');
                });
                break;

            case 'has_cancelled':
                $query->orWhereIn('customer_id', function ($sub): void {
                    $sub->select('customer_id')
                        ->from('orders')
                        ->where('status', 'cancelled')
                        ->whereNull('deleted_at');
                });
                break;

            case 'has_rejected':
                $query->orWhereIn('customer_id', function ($sub): void {
                    $sub->select('customer_id')
                        ->from('orders')
                        ->where('status', 'returned')
                        ->whereNull('deleted_at');
                });
                break;

            case 'has_returned':
                $query->orWhereIn('customer_id', function ($sub): void {
                    $sub->select('customer_id')
                        ->from('orders')
                        ->where('status', 'returned')
                        ->whereNull('deleted_at');
                });
                break;

            case 'incomplete':
                $query->orWhereNotIn('status', ['completed', 'cancelled']);
                break;
        }
    }

    public function listPaymentMethods(string $companyId): array
    {
        $methods = Order::query()
            ->where('company_id', $companyId)
            ->whereNotNull('payment_method')
            ->distinct()
            ->pluck('payment_method')
            ->filter()
            ->values();

        $manual = Order::query()
            ->where('company_id', $companyId)
            ->whereNotNull('payment_method_manual')
            ->distinct()
            ->pluck('payment_method_manual')
            ->filter()
            ->values();

        return $methods->merge($manual)->unique()->sort()->values()->all();
    }

    public function listShippingCompanies(string $companyId): array
    {
        return Order::query()
            ->where('company_id', $companyId)
            ->whereNotNull('shipping_method')
            ->where('shipping_method', '!=', '')
            ->distinct()
            ->pluck('shipping_method')
            ->filter()
            ->sort()
            ->values()
            ->all();
    }

    public function findById(string $id): ?Order
    {
        return Order::query()->with(self::WITH_DETAIL)->find($id);
    }

    public function create(array $attributes, array $lines): Order
    {
        $order = Order::query()->create($attributes);
        $order->lines()->createMany($lines);

        return $this->findById((string) $order->id) ?? $order;
    }

    public function update(Order $order, array $attributes, array $lines): Order
    {
        $order->update($attributes);
        $order->lines()->delete();
        $order->lines()->createMany($lines);

        return $this->findById((string) $order->id) ?? $order->refresh();
    }

    public function delete(Order $order): void
    {
        $order->delete();
    }

    public function nextOrderNumber(): string
    {
        // withoutGlobalScopes() bypasses the tenant scope so the sequence is
        // globally unique across all companies (matching the unique constraint).
        $last = Order::withoutGlobalScopes()
            ->withTrashed()
            ->orderByRaw("CAST(REPLACE(order_number, 'ORD-', '') AS UNSIGNED) DESC")
            ->value('order_number');

        if ($last === null) {
            return 'ORD-00001';
        }

        $current = (int) str_replace('ORD-', '', (string) $last);

        return 'ORD-'.str_pad((string) ($current + 1), 5, '0', STR_PAD_LEFT);
    }
}
