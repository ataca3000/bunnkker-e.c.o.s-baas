<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H2. Official holidays.
 *
 * Company-wide non-working days. A holiday spans a range because the ones that
 * matter here — Eid Al-Fitr and Eid Al-Adha — run for several days, and their
 * dates move each year, so they are recorded per occurrence rather than derived.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_official_holidays')) {
            return;
        }

        Schema::create('hr_official_holidays', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();

            $table->string('name', 150);
            $table->date('start_date');
            $table->date('end_date');            // equals start_date for a single day
            $table->string('type', 20)->default('public');   // public | religious | national | company
            $table->string('notes', 300)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['company_id', 'start_date', 'end_date'], 'hr_holiday_range_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_official_holidays');
    }
};
