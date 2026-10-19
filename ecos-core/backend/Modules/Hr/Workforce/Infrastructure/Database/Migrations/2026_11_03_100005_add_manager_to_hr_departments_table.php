<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H1. The department head.
 *
 * Deferred to its own migration because departments and employees reference each
 * other: an employee belongs to a department, and a department is led by an
 * employee. The constraint can only be added once both tables exist.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('hr_departments') || Schema::hasColumn('hr_departments', 'manager_employee_id')) {
            return;
        }

        Schema::table('hr_departments', function (Blueprint $table): void {
            $table->foreignUuid('manager_employee_id')->nullable()->after('branch_id')
                ->constrained('hr_employees')->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('hr_departments') || ! Schema::hasColumn('hr_departments', 'manager_employee_id')) {
            return;
        }

        Schema::table('hr_departments', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('manager_employee_id');
        });
    }
};
