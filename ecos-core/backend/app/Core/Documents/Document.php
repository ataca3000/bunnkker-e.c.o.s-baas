<?php

declare(strict_types=1);

namespace App\Core\Documents;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

final class Document extends Model
{
    use SoftDeletes;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $table = 'documents';

    protected $fillable = [
        'id',
        'company_id',
        'subject_type',
        'subject_id',
        'document_type',
        'name',
        'file_path',
        'mime_type',
        'file_size',
        'uploaded_by',
        'notes',
        'version',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }
}
