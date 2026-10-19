<?php

declare(strict_types=1);

namespace Modules\Crm\Customers\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Metadata for a document attached to a customer. */
class CustomerDocument extends Model
{
    use HasUuids;

    protected $table = 'crm_customer_documents';

    protected $fillable = ['customer_id', 'name', 'doc_type', 'file_path', 'mime_type', 'size_bytes', 'uploaded_by'];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }
}
