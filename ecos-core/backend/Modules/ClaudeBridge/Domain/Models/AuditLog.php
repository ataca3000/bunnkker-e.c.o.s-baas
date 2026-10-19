<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Modules\ClaudeBridge\Domain\Enums\ActorType;

/**
 * Append-only. No UPDATE or DELETE is ever issued on this model.
 *
 * @property int $id
 * @property string $company_id
 * @property ActorType $actor_type
 * @property string $actor_id
 * @property string $actor_name
 * @property string $action
 * @property string|null $task_id
 * @property string $description
 * @property \Carbon\Carbon $occurred_at
 */
final class AuditLog extends Model
{
    protected $table = 'cb_audit_log';

    public $timestamps = false;

    public $incrementing = true;

    protected $keyType = 'integer';

    protected $fillable = [
        'company_id',
        'actor_type',
        'actor_id',
        'actor_name',
        'action',
        'task_id',
        'description',
        'occurred_at',
    ];

    protected $casts = [
        'actor_type' => ActorType::class,
        'occurred_at' => 'datetime',
    ];

    public static function record(
        string $companyId,
        ActorType $actorType,
        string $actorId,
        string $actorName,
        string $action,
        string $description,
        ?string $taskId = null,
    ): void {
        self::create([
            'company_id' => $companyId,
            'actor_type' => $actorType,
            'actor_id' => $actorId,
            'actor_name' => $actorName,
            'action' => $action,
            'task_id' => $taskId,
            'description' => $description,
            'occurred_at' => now(),
        ]);
    }
}
