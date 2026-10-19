<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Device/session metadata on top of the Sanctum token store (ADR-040).
 * `token_id` points at personal_access_tokens.id; revoking a session revokes that token.
 *
 * @property ?int $token_id
 * @property ?\Illuminate\Support\Carbon $revoked_at
 */
class UserSession extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $table = 'user_sessions';

    protected $fillable = [
        'user_id', 'token_id', 'ip_address', 'user_agent', 'browser', 'platform',
        'login_at', 'last_activity_at', 'revoked_at',
    ];

    protected $casts = [
        'login_at' => 'datetime',
        'last_activity_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isActive(): bool
    {
        return $this->revoked_at === null;
    }
}
