<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A user invitation / activation token (ADR-040). Only the token HASH is stored — the raw
 * token is returned once at creation and never persisted.
 *
 * @property string $status
 * @property ?\Illuminate\Support\Carbon $expires_at
 */
class UserInvitation extends Model
{
    use HasUuids;

    public const STATUS_PENDING = 'pending';

    public const STATUS_ACCEPTED = 'accepted';

    public const STATUS_EXPIRED = 'expired';

    public const STATUS_REVOKED = 'revoked';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $table = 'user_invitations';

    protected $fillable = [
        'user_id', 'email', 'token_hash', 'status', 'expires_at', 'accepted_at', 'invited_by',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'accepted_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }
}
