<?php

declare(strict_types=1);

namespace Modules\MasterData\Categories\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validation for creating a category.
 */
final class StoreCategoryRequest extends FormRequest
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
            'parent_id' => ['nullable', 'uuid', 'exists:categories,id'],
            'code' => ['required', 'string', 'max:50', 'unique:categories,code'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:500'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['boolean'],
            'category_scope' => ['sometimes', 'string', 'in:product,material'],
        ];
    }
}
