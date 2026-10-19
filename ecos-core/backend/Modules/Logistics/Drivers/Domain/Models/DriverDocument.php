<?php

declare(strict_types=1);

namespace Modules\Logistics\Drivers\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A file attached to a driver record (licence scan, ID, contract, …).
 */
class DriverDocument extends Model
{
    public const TYPE_LICENSE = 'license';

    public const TYPE_NATIONAL_ID = 'national_id';

    public const TYPE_EMPLOYMENT_CONTRACT = 'employment_contract';

    public const TYPE_MEDICAL_CERTIFICATE = 'medical_certificate';

    public const TYPE_OTHER = 'other';

    public const TYPES = [
        self::TYPE_LICENSE,
        self::TYPE_NATIONAL_ID,
        self::TYPE_EMPLOYMENT_CONTRACT,
        self::TYPE_MEDICAL_CERTIFICATE,
        self::TYPE_OTHER,
    ];

    protected $table = 'logistics_driver_documents';

    protected $fillable = [
        'driver_id',
        'type',
        'title',
        'file_path',
        'file_name',
        'mime_type',
        'size_bytes',
        'issued_at',
        'expires_at',
        'notes',
        'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
            'issued_at' => 'date:Y-m-d',
            'expires_at' => 'date:Y-m-d',
            'size_bytes' => 'integer',
        ];
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class, 'driver_id');
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->lt(Carbon::today());
    }
}
