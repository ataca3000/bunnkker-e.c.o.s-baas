<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseOrders\Infrastructure\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\Organization\Companies\Domain\Models\Company;
use Modules\Purchasing\PurchaseOrders\Domain\Enums\PurchaseOrderStatus;
use Modules\Purchasing\PurchaseOrders\Domain\Models\PurchaseOrder;
use Modules\Purchasing\Suppliers\Domain\Models\Supplier;

/**
 * @extends Factory<PurchaseOrder>
 */
final class PurchaseOrderFactory extends Factory
{
    /** @var class-string<PurchaseOrder> */
    protected $model = PurchaseOrder::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'po_number' => 'PO-'.str_pad((string) $this->faker->unique()->numberBetween(1, 99999), 5, '0', STR_PAD_LEFT),
            'company_id' => Company::factory(),
            'supplier_id' => Supplier::factory(),
            'order_date' => $this->faker->dateTimeBetween('-3 months', 'now')->format('Y-m-d'),
            'expected_date' => $this->faker->dateTimeBetween('now', '+2 months')->format('Y-m-d'),
            'status' => PurchaseOrderStatus::Draft->value,
            'subtotal' => 0,
            'grand_total' => 0,
            'total' => 0,
        ];
    }

    public function submitted(): self
    {
        return $this->state(fn (): array => ['status' => PurchaseOrderStatus::Submitted->value]);
    }

    public function approved(): self
    {
        return $this->state(fn (): array => [
            'status' => PurchaseOrderStatus::Approved->value,
            'approved_at' => now(),
        ]);
    }

    public function cancelled(): self
    {
        return $this->state(fn (): array => ['status' => PurchaseOrderStatus::Cancelled->value]);
    }

    public function closed(): self
    {
        return $this->state(fn (): array => ['status' => PurchaseOrderStatus::Closed->value]);
    }
}
