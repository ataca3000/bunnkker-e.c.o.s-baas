<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class FuelCard extends Model
{
    protected $table = 'fleet_fuel_cards';

    /** @var array<string, mixed> */
    protected $attributes = [
        'is_active' => true,
    ];

    protected $fillable = [
        'uuid', 'fleet_id', 'company_id',
        'card_number', 'provider', 'holder_name', 'expires_on', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'expires_on' => 'date:Y-m-d',
            'is_active' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $card): void {
            if ($card->uuid === null) {
                $card->uuid = (string) Str::uuid();
            }
        });
    }

    public function fleet(): BelongsTo
    {
        return $this->belongsTo(Fleet::class, 'fleet_id');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(FuelTransaction::class, 'fuel_card_id');
    }

    public function isExpired(?Carbon $at = null): bool
    {
        return $this->expires_on !== null
            && ($at ?? Carbon::today())->gt($this->expires_on);
    }

    public function isUsable(): bool
    {
        return $this->is_active && ! $this->isExpired();
    }
}
