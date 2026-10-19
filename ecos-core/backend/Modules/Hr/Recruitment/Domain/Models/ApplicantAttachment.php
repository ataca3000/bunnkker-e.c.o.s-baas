<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A file a candidate supplied — CV, photo, certificate.
 *
 * `is_public_upload` records that this arrived through the careers portal rather
 * than from a member of staff, which is exactly the distinction anything
 * downstream (scanning, retention, access) needs to make.
 */
class ApplicantAttachment extends Model
{
    use HasUuids;

    protected $table = 'hr_applicant_attachments';

    protected $fillable = [
        'company_id', 'applicant_id', 'application_id', 'interview_id',
        'type', 'title', 'file_path', 'file_name', 'mime_type', 'file_size',
        'is_public_upload', 'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
            'file_size' => 'integer',
            'is_public_upload' => 'boolean',
        ];
    }

    public function applicant(): BelongsTo
    {
        return $this->belongsTo(Applicant::class, 'applicant_id');
    }
}
