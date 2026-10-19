<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class CreateLoadingSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'warehouse_id' => ['required', 'uuid'],
            'operational_date' => ['required', 'date_format:Y-m-d'],
            'session_type' => ['nullable', 'string', 'in:standard,rush,rerun,supplementary'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
