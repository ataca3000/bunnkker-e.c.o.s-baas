<?php

declare(strict_types=1);

namespace Modules\Inventory\WasteInvestigations\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WasteInvestigationAttachment extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'investigation_id',
        'file_path',
        'file_name',
        'mime_type',
        'file_size',
        'description',
        'uploaded_by',
    ];

    /** @return BelongsTo<WasteInvestigation, $this> */
    public function investigation(): BelongsTo
    {
        return $this->belongsTo(WasteInvestigation::class, 'investigation_id');
    }
}
