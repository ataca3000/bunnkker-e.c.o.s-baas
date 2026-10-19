<?php

declare(strict_types=1);

namespace Modules\Commerce\ProductMappings\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\Commerce\ProductMappings\Domain\Enums\SyncStatus;

final class StoreProductMappingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $statuses = array_column(SyncStatus::cases(), 'value');

        return [
            'product_id' => ['required', 'uuid', 'exists:products,id'],
            'channel_id' => ['required', 'uuid', 'exists:channels,id'],
            'external_product_id' => ['required', 'string', 'max:255'],
            'external_sku' => ['nullable', 'string', 'max:255'],
            'sync_status' => ['string', Rule::in($statuses)],
        ];
    }
}
