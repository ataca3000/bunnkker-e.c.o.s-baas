<?php

declare(strict_types=1);

namespace Modules\MasterData\Warehouses\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validation for creating a warehouse. Code is optional — auto-generated if omitted.
 */
final class StoreWarehouseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        $companyId = (string) $this->input('company_id');

        return [
            'company_id' => ['required', 'uuid', 'exists:companies,id'],
            'code' => [
                'nullable',
                'string',
                'max:20',
                Rule::unique('warehouses', 'code')->where(
                    fn ($query) => $query->where('company_id', $companyId)->whereNull('deleted_at'),
                ),
            ],
            'name' => ['required', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'country' => ['nullable', 'string', 'max:100'],
            'is_active' => ['boolean'],
        ];
    }
}
