<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H1. Employment types.
 *
 * Full time, part time, contractor and so on — a per-company lookup rather than a
 * hard-coded enum, because the list differs by organisation and is administered,
 * not deployed.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_employment_types')) {
            return;
        }

        Schema::create('hr_employment_types', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();

            $table->string('code', 30);
            $table->string('name', 100);
            $table->string('description', 300)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'code'], 'hr_employment_type_code_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_employment_types');
    }
};
