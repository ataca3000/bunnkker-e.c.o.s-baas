<?php

declare(strict_types=1);

namespace Modules\Commerce\Channels\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Stores API credentials for a channel. Never serialised into API responses.
 *
 * @property string $id
 * @property string $channel_id
 * @property string $consumer_key
 * @property string $consumer_secret
 */
class ChannelCredential extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'channel_id',
        'consumer_key',
        'consumer_secret',
    ];

    /**
     * @return BelongsTo<Channel, $this>
     */
    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class);
    }
}
