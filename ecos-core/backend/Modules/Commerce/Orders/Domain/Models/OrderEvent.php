<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Http\Request;

/**
 * @property string $id
 * @property string $order_id
 * @property string $event_type
 * @property string $description
 * @property string|null $actor_id
 * @property string|null $actor_name
 * @property string|null $actor_role
 * @property string|null $actor_email
 * @property string|null $actor_type user|system|api|automation|woocommerce|webhook
 * @property string|null $source dashboard|mobile_app|api|woocommerce|automation|cron|webhook
 * @property string|null $action_type created|updated|deleted|workflow|payment|inventory|customer|shipping|system|automation
 * @property array|null $previous_value
 * @property array|null $new_value
 * @property array|null $changed_fields
 * @property string|null $reason
 * @property string|null $ip_address
 * @property string|null $user_agent
 * @property string|null $module
 * @property array|null $payload
 * @property array|null $metadata
 */
final class OrderEvent extends Model
{
    use HasUuids;

    public $incrementing = false;

    public $timestamps = false;

    protected $keyType = 'string';

    protected $fillable = [
        'order_id',
        'event_type',
        'description',
        'actor_id',
        'actor_name',
        'actor_role',
        'actor_email',
        'actor_type',
        'source',
        'action_type',
        'previous_value',
        'new_value',
        'changed_fields',
        'reason',
        'ip_address',
        'user_agent',
        'module',
        'payload',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'previous_value' => 'array',
            'new_value' => 'array',
            'changed_fields' => 'array',
            'metadata' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    // ── Factories ─────────────────────────────────────────────────────────────

    /**
     * Create an audit event. Backward-compatible — new params are all optional.
     */
    public static function log(
        string $orderId,
        string $type,
        string $description,
        array $payload = [],
        ?string $actorId = null,
        ?string $actorName = null,
        ?array $previousValue = null,
        ?array $newValue = null,
        ?string $module = null,
        ?string $actorType = null,
        ?string $source = null,
        ?string $actionType = null,
        ?array $changedFields = null,
        ?string $reason = null,
        ?string $ipAddress = null,
        ?string $userAgent = null,
        ?array $metadata = null,
        ?string $actorRole = null,
        ?string $actorEmail = null,
    ): static {
        return self::create([
            'order_id' => $orderId,
            'event_type' => $type,
            'description' => $description,
            'actor_id' => $actorId,
            'actor_name' => $actorName,
            'actor_role' => $actorRole,
            'actor_email' => $actorEmail,
            'actor_type' => $actorType,
            'source' => $source,
            'action_type' => $actionType,
            'previous_value' => $previousValue,
            'new_value' => $newValue,
            'changed_fields' => $changedFields,
            'reason' => $reason,
            'ip_address' => $ipAddress,
            'user_agent' => $userAgent,
            'module' => $module ?? 'orders',
            'payload' => $payload ?: null,
            'metadata' => $metadata,
        ]);
    }

    /**
     * Create an event enriched with HTTP request context (IP, UA, source, actor_type).
     * Use from controller/action layers where a Request object is available.
     */
    public static function logFromRequest(
        Request $request,
        string $orderId,
        string $type,
        string $description,
        array $payload = [],
        ?string $actorId = null,
        ?string $actorName = null,
        ?array $previousValue = null,
        ?array $newValue = null,
        ?string $module = null,
        ?string $actionType = null,
        ?array $changedFields = null,
        ?string $reason = null,
        ?array $metadata = null,
        ?string $actorRole = null,
    ): static {
        $ua = $request->userAgent();

        $resolvedRole = $actorRole ?? $request->user()?->roles()->value('name');
        $resolvedEmail = $request->user()?->email;

        return static::log(
            orderId: $orderId,
            type: $type,
            description: $description,
            payload: $payload,
            actorId: $actorId,
            actorName: $actorName,
            previousValue: $previousValue,
            newValue: $newValue,
            module: $module,
            actorType: $actorId ? 'user' : 'system',
            source: self::resolveSource($ua ?? ''),
            actionType: $actionType,
            changedFields: $changedFields,
            reason: $reason,
            ipAddress: $request->ip(),
            userAgent: $ua ? substr($ua, 0, 500) : null,
            metadata: $metadata,
            actorRole: $resolvedRole,
            actorEmail: $resolvedEmail,
        );
    }

    private static function resolveSource(string $userAgent): string
    {
        $ua = strtolower($userAgent);
        if (str_contains($ua, 'woocommerce') || str_contains($ua, 'wordpress')) {
            return 'woocommerce';
        }
        if (str_contains($ua, 'okhttp') || str_contains($ua, 'dart') || str_contains($ua, 'flutter')) {
            return 'mobile_app';
        }
        if (empty($ua)) {
            return 'cron';
        }

        return 'dashboard';
    }
}
