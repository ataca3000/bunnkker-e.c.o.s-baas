<?php

declare(strict_types=1);

namespace Modules\Marketing\MetaConnector\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;

/**
 * Tracks a Meta webhook subscription.
 *
 * Each row represents one webhook registration with Meta for a specific
 * object_type (page, instagram, catalog, leadgen, commerce, whatsapp).
 * The verify_token is encrypted at rest.
 *
 * @property string $id
 * @property string $company_id
 * @property string $marketing_connection_id
 * @property string $object_type
 * @property string|null $object_id
 * @property string $callback_url
 * @property string $verify_token
 * @property array $subscribed_fields
 * @property string $status
 * @property \Carbon\Carbon|null $verified_at
 * @property \Carbon\Carbon|null $last_delivery_at
 * @property string|null $last_error
 * @property int $retry_count
 * @property \Carbon\Carbon|null $last_verified_at
 */
class MetaWebhook extends Model
{
    use HasUuids;

    protected $table = 'meta_webhooks';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'marketing_connection_id',
        'object_type',
        'object_id',
        'callback_url',
        'verify_token',
        'subscribed_fields',
        'status',
        'verified_at',
        'last_delivery_at',
        'last_error',
        'retry_count',
        'last_verified_at',
        'created_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'subscribed_fields' => 'array',
            'verified_at' => 'datetime',
            'last_delivery_at' => 'datetime',
            'last_verified_at' => 'datetime',
            'verify_token' => 'encrypted',
        ];
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function markVerified(): void
    {
        $this->update([
            'status' => 'active',
            'verified_at' => now(),
            'last_verified_at' => now(),
            'last_error' => null,
        ]);
    }

    public function markFailed(string $error): void
    {
        $this->update([
            'status' => 'failed',
            'last_error' => $error,
            'retry_count' => $this->retry_count + 1,
        ]);
    }

    /** @return BelongsTo<MarketingConnection, $this> */
    public function connection(): BelongsTo
    {
        return $this->belongsTo(MarketingConnection::class, 'marketing_connection_id');
    }
}
