<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * The running commentary on an exception.
 *
 * Append-only, because the value is the sequence: what was tried, what was ruled
 * out, in the order it happened. Editing a note rewrites the reasoning, and the
 * next shift inherits a story that never took place.
 */
class ExceptionNote extends Model
{
    public const TYPE_NOTE = 'note';

    public const TYPE_ACTION = 'action_taken';

    public const TYPE_HANDOVER = 'handover';

    protected $table = 'ops_exception_notes';

    /** @var array<string, mixed> */
    protected $attributes = [
        'note_type' => self::TYPE_NOTE,
        'is_pinned' => false,
    ];

    protected $fillable = [
        'uuid', 'company_id', 'exception_id',
        'body', 'note_type', 'is_pinned',
        'written_at', 'author_id', 'author_name',
    ];

    protected function casts(): array
    {
        return [
            'is_pinned' => 'boolean',
            'written_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $note): void {
            if ($note->uuid === null) {
                $note->uuid = (string) Str::uuid();
            }

            if ($note->written_at === null) {
                $note->written_at = now();
            }

            // A handover is what the next shift reads first, so it pins itself.
            if ($note->note_type === self::TYPE_HANDOVER) {
                $note->is_pinned = true;
            }
        });

        static::updating(static fn () => false);
        static::deleting(static fn () => false);
    }

    public function exception(): BelongsTo
    {
        return $this->belongsTo(OperationalException::class, 'exception_id');
    }
}
