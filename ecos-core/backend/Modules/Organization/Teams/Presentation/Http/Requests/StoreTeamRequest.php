<?php

declare(strict_types=1);

namespace Modules\Organization\Teams\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreTeamRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        $companyId = (string) $this->input('company_id');

        return [
            'company_id' => ['required', 'uuid', 'exists:companies,id'],
            'name' => ['required', 'string', 'max:255'],
            'code' => [
                'nullable',
                'string',
                'max:20',
                Rule::unique('teams', 'code')->where(
                    fn ($q) => $q->where('company_id', $companyId)->whereNull('deleted_at'),
                ),
            ],
            'leader_name' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'is_active' => ['boolean'],
        ];
    }
}
