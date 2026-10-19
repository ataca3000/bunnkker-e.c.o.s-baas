<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Modules\Crm\Sales\Domain\Enums\LeadStatus;

/** A sales lead — a prospect the CRM owns, before or without a customer record. */
class Lead extends Model
{
    use HasUuids;

    protected $table = 'crm_leads';

    protected $fillable = [
        'company_id', 'name', 'phone', 'email', 'company_name', 'source', 'status', 'score',
        'owner_id', 'customer_id', 'converted_opportunity_id', 'converted_at', 'notes', 'tags', 'created_by',
    ];

    protected function casts(): array
    {
        return ['status' => LeadStatus::class, 'score' => 'integer', 'converted_at' => 'datetime', 'tags' => 'array'];
    }

    public function isConverted(): bool
    {
        return $this->status === LeadStatus::Converted;
    }
}
