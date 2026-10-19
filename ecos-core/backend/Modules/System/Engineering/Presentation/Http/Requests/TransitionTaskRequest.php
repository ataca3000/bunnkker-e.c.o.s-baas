<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Modules\System\Engineering\Domain\Enums\TaskStatus;

class TransitionTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', 'string', 'in:' . implode(',', TaskStatus::values())],
            'reason' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
