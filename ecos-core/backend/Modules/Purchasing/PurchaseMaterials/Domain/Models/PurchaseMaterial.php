<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseMaterials\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;
use Modules\Purchasing\PurchaseMaterials\Domain\Enums\PurchaseMaterialPriority;
use Modules\Purchasing\PurchaseMaterials\Domain\Enums\PurchaseMaterialStatus;

/**
 * Purchase Material request aggregate root.
 *
 * Represents a warehouse-initiated procurement request.
 * Supplier selection occurs ONLY during Procurement Review — never here.
 *
 * @property string $id
 * @property string $request_number
 * @property string|null $company_id
 * @property string|null $channel_id
 * @property string $warehouse_id
 * @property PurchaseMaterialStatus $status
 * @property PurchaseMaterialPriority $priority
 * @property string|null $requested_by
 * @property string|null $assigned_buyer
 * @property \Illuminate\Support\Carbon|null $required_date
 * @property \Illuminate\Support\Carbon|null $submitted_at
 * @property \Illuminate\Support\Carbon|null $approved_at
 * @property numeric-string $estimated_value
 * @property numeric-string $approved_value
 * @property numeric-string $purchased_value
 * @property string|null $approved_by
 * @property string|null $rejected_by
 * @property string|null $rejection_reason
 * @property string|null $created_by
 * @property string|null $updated_by
 * @property string|null $notes
 */
class PurchaseMaterial extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $table = 'purchase_materials';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'request_number',
        'record_type',
        'source_type',
        'company_id',
        'channel_id',
        'warehouse_id',
        'status',
        'priority',
        'requested_by',
        'assigned_buyer',
        'required_date',
        'submitted_at',
        'approved_at',
        'estimated_value',
        'approved_value',
        'purchased_value',
        'approved_by',
        'rejected_by',
        'rejection_reason',
        'review_notes',
        'merged_into',
        'clarification_requested_at',
        'clarification_requested_by',
        'created_by',
        'updated_by',
        'notes',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => PurchaseMaterialStatus::class,
            'priority' => PurchaseMaterialPriority::class,
            'required_date' => 'date',
            'submitted_at' => 'datetime',
            'approved_at' => 'datetime',
            'estimated_value' => 'decimal:2',
            'approved_value' => 'decimal:2',
            'purchased_value' => 'decimal:2',
            'clarification_requested_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Company, $this> */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /** @return BelongsTo<Warehouse, $this> */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    /** @return BelongsTo<Channel, $this> */
    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class);
    }

    /** @return HasMany<PurchaseMaterialLine, $this> */
    public function lines(): HasMany
    {
        return $this->hasMany(PurchaseMaterialLine::class);
    }
}
