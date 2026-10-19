<?php

declare(strict_types=1);

namespace Modules\MasterData\Units\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validation for creating a unit of measure.
 */
final class StoreUnitRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'code' => ['required', 'string', 'max:20', 'unique:units,code'],
            'name' => ['required', 'string', 'max:255'],
            'symbol' => ['nullable', 'string', 'max:20'],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['boolean'],
        ];
    }
}
