<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title'       => ['required', 'string', 'max:500'],
            'description' => ['nullable', 'string', 'max:50000'],
            'priority'    => ['nullable', 'integer', 'in:1,3,5,8,10'],
            'source_type' => ['nullable', 'string', 'in:manual,github_issue,jira,adr'],
            'source_ref'  => ['nullable', 'string', 'max:255'],
            'deadline'    => ['nullable', 'date'],
            'max_retries' => ['nullable', 'integer', 'min:0', 'max:10'],
            'metadata'    => ['nullable', 'array'],
            'label_ids'   => ['nullable', 'array'],
            'label_ids.*' => ['uuid', 'exists:engineering_task_labels,id'],
        ];
    }
}
