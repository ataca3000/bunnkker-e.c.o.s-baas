<?php

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PatchSnapshot extends Model
{
    use HasUuids;

    protected $table = 'engineering_patch_snapshots';

    public $timestamps = false;

    protected $fillable = [
        'patch_id',
        'session_id',
        'company_id',
        'file_path',
        'original_content',
        'file_existed',
        'is_restored',
        'restored_at',
        'restored_by',
        'created_at',
    ];

    public function casts(): array
    {
        return [
            'file_existed' => 'boolean',
            'is_restored'  => 'boolean',
            'restored_at'  => 'datetime',
            'created_at'   => 'datetime',
        ];
    }

    public function patch(): BelongsTo
    {
        return $this->belongsTo(RepairPatch::class, 'patch_id');
    }
}
