<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CampaignProduct extends Model
{
    use HasUuids;

    protected $table = 'marketing_campaign_products';

    protected $fillable = [
        'campaign_draft_id', 'product_type', 'product_id',
        'product_name', 'product_sku',
        'availability_status', 'quantity_available',
        'warn_if_unavailable', 'last_checked_at',
    ];

    protected $casts = [
        'warn_if_unavailable' => 'boolean',
        'last_checked_at' => 'datetime',
    ];

    public function draft(): BelongsTo
    {
        return $this->belongsTo(CampaignDraft::class, 'campaign_draft_id');
    }

    public function hasAvailabilityIssue(): bool
    {
        return in_array($this->availability_status, ['out_of_stock', 'discontinued', 'negative_stock'], true);
    }
}
