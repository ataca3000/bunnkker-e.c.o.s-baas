<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class AssignWorkerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'role' => ['required', 'string', 'in:operator,supervisor,quality_inspector'],
        ];
    }
}
