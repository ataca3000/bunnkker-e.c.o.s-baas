<?php

declare(strict_types=1);

namespace Modules\MasterData\Categories\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validation for updating a category. The unique `code` rule ignores the
 * category being updated.
 */
final class UpdateCategoryRequest extends FormRequest
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
        $categoryId = (string) $this->route('category');

        return [
            'parent_id' => ['nullable', 'uuid', 'exists:categories,id'],
            'code' => [
                'required',
                'string',
                'max:50',
                Rule::unique('categories', 'code')->ignore($categoryId),
            ],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:500'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['boolean'],
            'category_scope' => ['sometimes', 'string', 'in:product,material'],
        ];
    }
}
