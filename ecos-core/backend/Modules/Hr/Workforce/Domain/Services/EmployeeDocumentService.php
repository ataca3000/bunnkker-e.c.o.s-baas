<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Hr\Workforce\Domain\Enums\EmployeeDocumentType;
use Modules\Hr\Workforce\Domain\Models\Employee;
use Modules\Hr\Workforce\Domain\Models\EmployeeDocument;

/** Documents attached to a person, and the ones about to lapse. */
final class EmployeeDocumentService
{
    public function attach(Employee $employee, array $data, ?int $actorId = null): EmployeeDocument
    {
        $type = ($data['type'] ?? null) instanceof EmployeeDocumentType
            ? $data['type']
            : (EmployeeDocumentType::tryFrom((string) ($data['type'] ?? '')) ?? EmployeeDocumentType::Other);

        return EmployeeDocument::create([
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'type' => $type->value,
            'title' => $data['title'],
            'file_path' => $data['file_path'] ?? null,
            'file_name' => $data['file_name'] ?? null,
            'mime_type' => $data['mime_type'] ?? null,
            'file_size' => $data['file_size'] ?? null,
            'issued_at' => $data['issued_at'] ?? null,
            'expires_at' => $data['expires_at'] ?? null,
            'reference' => $data['reference'] ?? null,
            'notes' => $data['notes'] ?? null,
            'uploaded_by' => $actorId,
        ]);
    }

    public function remove(EmployeeDocument $document): void
    {
        $document->delete();
    }

    /**
     * Documents lapsing inside the window, soonest first — including any already
     * past their date, because an expired permit is more urgent than a pending one.
     *
     * @return \Illuminate\Database\Eloquent\Collection<int, EmployeeDocument>
     */
    public function expiringWithin(string $companyId, int $days = 60)
    {
        return EmployeeDocument::query()
            ->with('employee:id,first_name,last_name,employee_number')
            ->where('company_id', $companyId)
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', Carbon::now()->addDays($days)->toDateString())
            ->orderBy('expires_at')
            ->get();
    }
}
