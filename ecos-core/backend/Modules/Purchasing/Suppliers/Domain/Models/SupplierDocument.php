<?php

declare(strict_types=1);

namespace Modules\Purchasing\Suppliers\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property string $id
 * @property string $supplier_id
 * @property string $document_type commercial_registration|tax_card|contract|certificate|attachment
 * @property string $name
 * @property string $file_path
 * @property string $mime_type
 * @property int $file_size
 * @property string|null $notes
 * @property string|null $uploaded_by
 * @property \Illuminate\Support\Carbon $created_at
 * @property \Illuminate\Support\Carbon $updated_at
 */
class SupplierDocument extends Model
{
    use HasUuids, SoftDeletes;

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'supplier_id',
        'document_type',
        'name',
        'file_path',
        'mime_type',
        'file_size',
        'notes',
        'uploaded_by',
    ];

    /** @return BelongsTo<Supplier, $this> */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }
}
