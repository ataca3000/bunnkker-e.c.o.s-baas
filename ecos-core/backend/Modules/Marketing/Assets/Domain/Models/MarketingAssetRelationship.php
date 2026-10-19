<?php

declare(strict_types=1);

namespace Modules\Marketing\Assets\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * M2M relationship between a MarketingAsset and an ERP entity.
 *
 * related_type: 'company' | 'brand' | 'channel' | 'team'
 * related_id:   UUID of the entity
 *
 * Supports both manual mapping (mapped_by) and auto-suggested mapping
 * (is_auto_suggested = true, confidence = 0-100) awaiting user acceptance.
 *
 * @property string $id
 * @property string $marketing_asset_id
 * @property string $related_type
 * @property string $related_id
 * @property string|null $mapped_by
 * @property \Carbon\Carbon|null $mapped_at
 * @property int|null $confidence
 * @property bool $is_auto_suggested
 * @property \Carbon\Carbon|null $accepted_at
 * @property string|null $accepted_by
 * @property \Carbon\Carbon|null $rejected_at
 * @property string|null $rejected_by
 */
class MarketingAssetRelationship extends Model
{
    use HasUuids;

    protected $table = 'marketing_asset_relationships';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'marketing_asset_id',
        'related_type',
        'related_id',
        'mapped_by',
        'mapped_at',
        'confidence',
        'is_auto_suggested',
        'accepted_at',
        'accepted_by',
        'rejected_at',
        'rejected_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'mapped_at' => 'datetime',
            'accepted_at' => 'datetime',
            'rejected_at' => 'datetime',
            'is_auto_suggested' => 'boolean',
            'confidence' => 'integer',
        ];
    }

    public function isAccepted(): bool
    {
        return $this->accepted_at !== null && $this->rejected_at === null;
    }

    public function isPending(): bool
    {
        return $this->is_auto_suggested && $this->accepted_at === null && $this->rejected_at === null;
    }

    /** @return BelongsTo<MarketingAsset, $this> */
    public function asset(): BelongsTo
    {
        return $this->belongsTo(MarketingAsset::class, 'marketing_asset_id');
    }
}
