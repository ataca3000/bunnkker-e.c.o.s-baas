<?php

declare(strict_types=1);

namespace Modules\Organization\Branches\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validation for updating a branch. The unique `code` rule is scoped to the
 * company and ignores the branch being updated.
 */
final class UpdateBranchRequest extends FormRequest
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
        $branchId = (string) $this->route('branch');

        return [
            'company_id' => ['required', 'uuid', 'exists:companies,id'],
            'code' => [
                'required',
                'string',
                'max:50',
                Rule::unique('branches', 'code')
                    ->where(fn ($query) => $query->where('company_id', $companyId)->whereNull('deleted_at'))
                    ->ignore($branchId),
            ],
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'manager_name' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'country' => ['nullable', 'string', 'max:100'],
            'is_head_office' => ['boolean'],
            'is_active' => ['boolean'],
            'default_warehouse_id' => ['nullable', 'uuid', 'exists:warehouses,id'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ];
    }
}
