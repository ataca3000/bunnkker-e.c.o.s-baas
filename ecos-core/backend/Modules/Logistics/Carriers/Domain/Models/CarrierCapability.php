<?php

declare(strict_types=1);

namespace Modules\Logistics\Carriers\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Logistics\Carriers\Domain\ValueObjects\CarrierCapabilitySet;

/** A declared capability, persisted so the core can query without calling out. */
class CarrierCapability extends Model
{
    protected $table = 'carrier_capabilities';

    /** @var array<string, mixed> */
    protected $attributes = [
        'is_supported' => true,
    ];

    protected $fillable = ['carrier_account_id', 'capability', 'is_supported', 'constraints'];

    protected function casts(): array
    {
        return [
            'is_supported' => 'boolean',
            'constraints' => 'array',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(CarrierAccount::class, 'carrier_account_id');
    }

    /** What its absence means operationally — answerable without opening an adapter. */
    public function absenceMeaning(): string
    {
        return CarrierCapabilitySet::absenceMeaning($this->capability);
    }
}
