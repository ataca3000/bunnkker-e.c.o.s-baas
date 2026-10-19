<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseMaterials\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePurchaseMaterialRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'warehouse_id' => ['required', 'uuid', 'exists:warehouses,id'],
            'company_id' => ['nullable', 'uuid', 'exists:companies,id'],
            'channel_id' => ['nullable', 'string', 'max:100'],
            'priority' => ['sometimes', 'string', 'in:low,normal,high,urgent'],
            'required_date' => ['nullable', 'date', 'after_or_equal:today'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'record_type' => ['sometimes', 'string', 'in:material_request,purchase'],
            'source_type' => ['nullable', 'string', 'in:material_request,direct,reorder,ai,manual'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.product_id' => ['required', 'uuid', 'exists:products,id'],
            'lines.*.requested_qty' => ['required', 'numeric', 'min:0.0001'],
            'lines.*.unit_label' => ['nullable', 'string', 'max:50'],
            'lines.*.notes' => ['nullable', 'string', 'max:500'],
        ];
    }
}
