<?php

declare(strict_types=1);

namespace Modules\Organization\Branches\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class UpdateCoverageAreaRequest extends FormRequest
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
        $branchId = (string) $this->route('branch');
        $areaId   = (string) $this->route('area');

        return [
            'master_governorate_id' => [
                'required',
                'uuid',
                'exists:master_governorates,id',
                Rule::unique('branch_coverage_areas', 'master_governorate_id')
                    ->where('branch_id', $branchId)
                    ->where('master_zone_id', $this->input('master_zone_id'))
                    ->ignore($areaId),
            ],
            'master_zone_id' => ['nullable', 'uuid', 'exists:master_zones,id'],
            'priority' => ['integer', 'min:1', 'max:9999'],
            'is_active' => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'master_governorate_id.unique' => 'This branch already has a coverage rule for the selected governorate and zone.',
        ];
    }
}
