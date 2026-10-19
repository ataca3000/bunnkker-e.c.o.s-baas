<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $order_id
 * @property string $code
 * @property float $discount
 */
class OrderCoupon extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    protected $fillable = ['order_id', 'code', 'discount'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['discount' => 'float'];
    }

    /**
     * @return BelongsTo<Order, $this>
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
