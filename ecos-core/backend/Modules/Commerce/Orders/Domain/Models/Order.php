<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Domain\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Auth;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Enums\ReservationStatus;
use Modules\Commerce\Orders\Domain\Exceptions\UnauthorizedOrderStatusWriteException;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Operations\Fulfillment\Application\OrderStatusGuard;
use Modules\Sales\Customers\Domain\Models\Customer;

/**
 * Commerce order — internal order entity.
 *
 * @property string $id
 * @property string|null $channel_id
 * @property string|null $assigned_warehouse_id
 * @property string $customer_id
 * @property string|null $customer_name Order snapshot — name at time of creation/edit
 * @property string|null $customer_secondary_phone Order snapshot — secondary phone at time of creation/edit
 * @property string|null $customer_notes Order snapshot — notes at time of creation/edit
 * @property string|null $external_order_id
 * @property string $order_number
 * @property string $order_date
 * @property OrderStatus $status
 * @property float $subtotal
 * @property float $total
 * @property string|null $notes
 * @property string|null $billing_first_name
 * @property string|null $billing_last_name
 * @property string|null $billing_company
 * @property string|null $billing_country
 * @property string|null $billing_state
 * @property string|null $billing_city
 * @property string|null $billing_address_1
 * @property string|null $billing_address_2
 * @property string|null $billing_postcode
 * @property string|null $billing_phone
 * @property string|null $billing_email
 * @property string|null $shipping_first_name
 * @property string|null $shipping_last_name
 * @property string|null $shipping_company
 * @property string|null $shipping_country
 * @property string|null $shipping_state
 * @property string|null $shipping_city
 * @property string|null $shipping_address_1
 * @property string|null $shipping_address_2
 * @property string|null $shipping_postcode
 * @property string|null $customer_note
 * @property string|null $payment_method
 * @property string|null $payment_method_title
 * @property string|null $transaction_id
 * @property \Illuminate\Support\Carbon|null $date_paid
 * @property string|null $shipping_method
 * @property float $shipping_total
 * @property float $discount_total
 * @property float $tax_total
 * @property \Illuminate\Support\Carbon|null $inventory_reserved_at
 * @property \Illuminate\Support\Carbon|null $inventory_shipped_at
 * @property \Illuminate\Support\Carbon|null $inventory_released_at
 * @property float|null $actual_cogs_amount
 * @property float|null $actual_margin_amount
 * @property float|null $actual_margin_percent
 * @property string|null $requested_delivery_date
 * @property string|null $preferred_delivery_time
 * @property string|null $delivery_window_id
 * @property string|null $delivery_window
 * @property string|null $delivery_zone_id
 * @property string|null $delivery_zone
 * @property string|null $company_id
 * @property string|null $payment_method_manual
 * @property string|null $payment_proof_path
 * @property string|null $governorate
 * @property string|null $city
 * @property string|null $shipping_address
 * @property string|null $building
 * @property string|null $floor
 * @property string|null $apartment
 * @property string|null $landmark
 * @property string|null $address_notes
 * @property string|null $area
 * @property float|null $shipping_cost
 * @property string|null $shipping_cost_source
 * @property float $discount_amount
 * @property string|null $discount_type
 * @property float $deposit_amount
 * @property float $remaining_balance
 * @property float|null $google_maps_lat
 * @property float|null $google_maps_lng
 * @property string|null $google_maps_url
 * @property string|null $location_source
 * @property string|null $reservation_status
 * @property string|null $reservation_failure_reason
 */
class Order extends Model
{
    use HasUuids, SoftDeletes;

    public $incrementing = false;

    protected $keyType = 'string';

    protected static function booted(): void
    {
        static::addGlobalScope('tenant', static function (Builder $query): void {
            if (! Auth::check()) {
                return;
            }
            $companyId = Auth::user()?->company_id;
            if ($companyId === null) {
                return; // super-admin sees all orders
            }
            $query->where('company_id', $companyId);
        });

        // P9 — Architecture enforcement: status may only change through FulfillmentEngine::run().
        // Any direct $order->update(['status' => ...]) outside the engine throws here.
        // LoadVehicleWorkflow is the only authorized non-engine caller (uses OrderStatusGuard::withAuthorization).
        static::updating(static function (Order $order): void {
            if ($order->isDirty('status') && ! OrderStatusGuard::isActive()) {
                throw new UnauthorizedOrderStatusWriteException(
                    "Unauthorized direct write to Order[{$order->id}].status detected. ".
                    'All status transitions must go through FulfillmentEngine::run($workflow, $order).',
                );
            }
        });
    }

    /**
     * @var list<string>
     */
    protected $fillable = [
        'channel_id',
        'assigned_warehouse_id',
        'customer_id',
        'customer_name',
        'external_order_id',
        'order_number',
        'order_date',
        'status',
        'subtotal',
        'total',
        'notes',
        'customer_notes',
        'billing_first_name',
        'billing_last_name',
        'billing_company',
        'billing_country',
        'billing_state',
        'billing_city',
        'billing_address_1',
        'billing_address_2',
        'billing_postcode',
        'billing_phone',
        'customer_secondary_phone',
        'billing_email',
        'shipping_first_name',
        'shipping_last_name',
        'shipping_company',
        'shipping_country',
        'shipping_state',
        'shipping_city',
        'shipping_address_1',
        'shipping_address_2',
        'shipping_postcode',
        'customer_note',
        'payment_method',
        'payment_method_title',
        'transaction_id',
        'date_paid',
        'shipping_method',
        'shipping_total',
        'discount_total',
        'tax_total',
        'inventory_reserved_at',
        'inventory_shipped_at',
        'inventory_released_at',
        'actual_cogs_amount',
        'actual_margin_amount',
        'actual_margin_percent',
        'requested_delivery_date',
        'preferred_delivery_time',
        'delivery_window_id',
        'delivery_window',
        'delivery_zone_id',
        'delivery_zone',
        'company_id',
        'payment_method_manual',
        'payment_proof_path',
        'governorate',
        'city',
        'shipping_address',
        'building',
        'floor',
        'apartment',
        'landmark',
        'address_notes',
        'area',
        'shipping_cost',
        'shipping_cost_source',
        'discount_amount',
        'discount_type',
        'deposit_amount',
        'remaining_balance',
        'google_maps_lat',
        'google_maps_lng',
        'google_maps_url',
        'location_source',
        'warehouse_assigned_at',
        'warehouse_assignment_source',
        'preparation_completed_at',
        'rescheduled_at',
        'next_delivery_date',
        'resume_from_status',
        'reschedule_reason',
        // Shipping logistics
        'shipping_company_name',
        'shipping_attempts',
        'tracking_number',
        // GPS provenance
        'location_set_by',
        // Customer confirmation
        'customer_confirmed_at',
        'customer_confirmed_by',
        'confirmation_result',
        // Internal notes (staff-only) + creator audit
        'internal_notes',
        'created_by_id',
        'created_by_name',
        // Status transition audit
        'previous_status',
        'status_entered_by',
        'status_entered_at',
        // Reservation lifecycle (TASK-INV-RESERVATION-LIFECYCLE-001)
        'reservation_status',
        'reservation_failure_reason',
        // Branch assignment (TASK-BRANCH-ASSIGNMENT-ENGINE-001)
        'assigned_branch_id',
        'warehouse_assignment_failure_reason',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => OrderStatus::class,
            'subtotal' => 'float',
            'total' => 'float',
            'shipping_total' => 'float',
            'discount_total' => 'float',
            'tax_total' => 'float',
            'order_date' => 'date:Y-m-d',
            'date_paid' => 'datetime',
            'inventory_reserved_at' => 'datetime',
            'inventory_shipped_at' => 'datetime',
            'inventory_released_at' => 'datetime',
            'actual_cogs_amount' => 'float',
            'actual_margin_amount' => 'float',
            'actual_margin_percent' => 'float',
            'requested_delivery_date' => 'date:Y-m-d',
            'shipping_cost' => 'float',
            'discount_amount' => 'float',
            'deposit_amount' => 'float',
            'remaining_balance' => 'float',
            'google_maps_lat' => 'float',
            'google_maps_lng' => 'float',
            'warehouse_assigned_at' => 'datetime',
            'preparation_completed_at' => 'datetime',
            'rescheduled_at' => 'datetime',
            'next_delivery_date' => 'date:Y-m-d',
            'customer_confirmed_at' => 'datetime',
            'shipping_attempts' => 'integer',
            'status_entered_at' => 'datetime',
            'reservation_status' => ReservationStatus::class,
        ];
    }

    /**
     * @return BelongsTo<Channel, $this>
     */
    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class);
    }

    /**
     * @return BelongsTo<Warehouse, $this>
     */
    public function assignedWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'assigned_warehouse_id');
    }

    /**
     * @return BelongsTo<Customer, $this>
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /**
     * @return HasMany<OrderLine, $this>
     */
    public function lines(): HasMany
    {
        return $this->hasMany(OrderLine::class);
    }

    /**
     * @return HasMany<OrderFee, $this>
     */
    public function fees(): HasMany
    {
        return $this->hasMany(OrderFee::class);
    }

    /**
     * @return HasMany<OrderCoupon, $this>
     */
    public function coupons(): HasMany
    {
        return $this->hasMany(OrderCoupon::class);
    }

    /**
     * The active (non-detached) session order record for this order.
     * Used by DailyPreparationSessionManager to check if order is already attached.
     *
     * @return HasOne<\Modules\Operations\Preparation\Domain\Models\PreparationSessionOrder, $this>
     */
    public function activeSessionOrder(): HasOne
    {
        return $this->hasOne(
            \Modules\Operations\Preparation\Domain\Models\PreparationSessionOrder::class,
            'order_id',
        )->whereNull('detached_at');
    }

    /**
     * @return HasMany<OrderNote, $this>
     */
    public function orderNotes(): HasMany
    {
        return $this->hasMany(OrderNote::class)->latest();
    }
}
