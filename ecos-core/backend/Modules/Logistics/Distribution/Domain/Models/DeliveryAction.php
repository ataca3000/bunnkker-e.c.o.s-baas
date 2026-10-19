<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Append-only record of what the driver did at a stop. */
class DeliveryAction extends Model
{
    protected $table = 'distribution_delivery_actions';

    protected $fillable = [
        'stop_id',
        'action_type',
        'reason',
        'notes',
        'new_delivery_date',
        'corrected_lat',
        'corrected_lng',
        'performed_by',
    ];

    protected function casts(): array
    {
        return [
            'new_delivery_date' => 'date:Y-m-d',
            'corrected_lat' => 'decimal:7',
            'corrected_lng' => 'decimal:7',
        ];
    }

    public function stop(): BelongsTo
    {
        return $this->belongsTo(DeliveryStop::class, 'stop_id');
    }
}
