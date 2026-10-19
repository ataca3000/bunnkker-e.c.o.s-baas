<?php

declare(strict_types=1);

namespace Modules\Crm\Customers\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\Crm\Customers\Domain\Enums\CustomerStatus;
use Modules\Crm\Customers\Domain\Enums\CustomerType;

/**
 * The Customer — the single source of truth for customer identity.
 *
 * ┌─ ONE IDENTITY · REFERENCED, NOT DUPLICATED ─────────────────────────────┐
 * │ This maps the existing `customers` master (the same table orders FK to    │
 * │ and Finance/POS reference by opaque UUID). The CRM Foundation enriches it   │
 * │ with individual/business identity, multiple contacts, tags, notes,         │
 * │ documents, preferences, groups and merge — additively, on the one table.   │
 * │ Commerce, Finance, Logistics and Marketing REFERENCE this; they never own  │
 * │ a copy.                                                                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class Customer extends Model
{
    use HasUuids;
    use SoftDeletes;

    protected $table = 'customers';

    protected $fillable = [
        'code', 'company_id', 'name', 'customer_type', 'first_name', 'last_name',
        'business_name', 'tax_registration_number', 'contact_person',
        'email', 'phone', 'mobile', 'country', 'city', 'governorate', 'area', 'address', 'notes',
        'is_active', 'status', 'customer_group_id', 'preferred_language', 'preferred_contact_method',
        'merged_into_id', 'archived_at', 'archived_by',
    ];

    protected function casts(): array
    {
        return [
            'customer_type' => CustomerType::class,
            'status' => CustomerStatus::class,
            'is_active' => 'boolean',
            'archived_at' => 'datetime',
        ];
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(CustomerGroup::class, 'customer_group_id');
    }

    public function phones(): HasMany
    {
        return $this->hasMany(CustomerPhone::class, 'customer_id');
    }

    public function emails(): HasMany
    {
        return $this->hasMany(CustomerEmail::class, 'customer_id');
    }

    public function addresses(): HasMany
    {
        return $this->hasMany(CustomerAddress::class, 'customer_id');
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(CustomerTag::class, 'crm_customer_tag_assignments', 'customer_id', 'tag_id')->withTimestamps();
    }

    public function customerNotes(): HasMany
    {
        return $this->hasMany(CustomerNote::class, 'customer_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(CustomerDocument::class, 'customer_id');
    }

    public function preferences(): HasMany
    {
        return $this->hasMany(CustomerPreference::class, 'customer_id');
    }

    public function mergedInto(): BelongsTo
    {
        return $this->belongsTo(self::class, 'merged_into_id');
    }

    public function isArchived(): bool
    {
        return $this->status === CustomerStatus::Archived;
    }

    public function isMerged(): bool
    {
        return $this->merged_into_id !== null;
    }

    /** The display name, from structured fields when present, else the legacy name. */
    public function displayName(): string
    {
        if ($this->customer_type === CustomerType::Business && $this->business_name) {
            return (string) $this->business_name;
        }

        $full = trim(((string) $this->first_name).' '.((string) $this->last_name));

        return $full !== '' ? $full : (string) $this->name;
    }
}
