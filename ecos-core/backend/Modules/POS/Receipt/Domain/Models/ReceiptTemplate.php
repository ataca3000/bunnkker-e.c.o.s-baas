<?php

declare(strict_types=1);

namespace Modules\POS\Receipt\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Configures the visual presentation of a printed receipt.
 *
 * Not an aggregate — templates are configuration, not business transactions.
 * The ReceiptRenderer consumes this model to produce a ReceiptRenderingModel.
 */
class ReceiptTemplate extends Model
{
    use HasUuids;

    protected $table = 'pos_receipt_templates';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'settings' => 'array',
        ];
    }

    /**
     * Retrieve a typed setting value, returning null when the key is absent.
     */
    public function getSetting(string $key): mixed
    {
        return ($this->settings ?? [])[$key] ?? null;
    }

    /**
     * Return the default template, or null if none has been configured.
     */
    public static function default(): ?self
    {
        return static::where('is_default', true)->first();
    }
}
