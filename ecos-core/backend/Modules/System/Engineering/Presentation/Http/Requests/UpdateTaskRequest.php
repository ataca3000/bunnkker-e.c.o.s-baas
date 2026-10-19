<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title'       => ['sometimes', 'nullable', 'string', 'max:500'],
            'description' => ['sometimes', 'nullable', 'string', 'max:50000'],
            'priority'    => ['sometimes', 'nullable', 'integer', 'in:1,3,5,8,10'],
            'source_type' => ['sometimes', 'nullable', 'string', 'in:manual,github_issue,jira,adr'],
            'source_ref'  => ['sometimes', 'nullable', 'string', 'max:255'],
            'deadline'    => ['sometimes', 'nullable', 'date'],
            'max_retries' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:10'],
            'metadata'    => ['sometimes', 'nullable', 'array'],
            'label_ids'   => ['sometimes', 'nullable', 'array'],
            'label_ids.*' => ['uuid', 'exists:engineering_task_labels,id'],
        ];
    }
}
