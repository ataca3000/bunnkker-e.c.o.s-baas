<?php

declare(strict_types=1);

namespace Modules\MasterData\Warehouses\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validation for updating a warehouse. Code is immutable after creation.
 */
final class UpdateWarehouseRequest extends FormRequest
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
        return [
            'name' => ['required', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'country' => ['nullable', 'string', 'max:100'],
            'is_active' => ['boolean'],
        ];
    }
}
