<?php

declare(strict_types=1);

namespace Modules\Inventory\CountSessions\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryCountLineAttachment extends Model
{
    use HasUuids;

    protected $table = 'inventory_count_line_attachments';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'count_line_id',
        'session_id',
        'file_path',
        'file_name',
        'mime_type',
        'file_size',
        'description',
        'uploaded_by',
    ];

    /** @return BelongsTo<InventoryCountLine, $this> */
    public function countLine(): BelongsTo
    {
        return $this->belongsTo(InventoryCountLine::class, 'count_line_id');
    }

    /** @return BelongsTo<InventoryCountSession, $this> */
    public function session(): BelongsTo
    {
        return $this->belongsTo(InventoryCountSession::class, 'session_id');
    }
}
