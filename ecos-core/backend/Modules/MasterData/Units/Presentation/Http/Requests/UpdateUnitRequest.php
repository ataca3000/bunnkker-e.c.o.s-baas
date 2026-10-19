<?php

declare(strict_types=1);

namespace Modules\MasterData\Units\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validation for updating a unit of measure. The unique `code` rule ignores the
 * unit being updated.
 */
final class UpdateUnitRequest extends FormRequest
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
        $unitId = (string) $this->route('unit');

        return [
            'code' => ['required', 'string', 'max:20', Rule::unique('units', 'code')->ignore($unitId)],
            'name' => ['required', 'string', 'max:255'],
            'symbol' => ['nullable', 'string', 'max:20'],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['boolean'],
        ];
    }
}
