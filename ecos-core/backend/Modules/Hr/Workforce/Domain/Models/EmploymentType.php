<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Full time, part time, contractor — an administered list, not a deployed enum. */
class EmploymentType extends Model
{
    use HasUuids;

    protected $table = 'hr_employment_types';

    protected $fillable = ['company_id', 'code', 'name', 'description', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function employees(): HasMany
    {
        return $this->hasMany(Employee::class, 'employment_type_id');
    }
}
