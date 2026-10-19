<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H2. Work calendars.
 *
 * Which days of the week the company works, and the default hours of a working
 * day. `working_days` holds ISO weekday numbers (1 = Monday … 7 = Sunday), so a
 * Sunday-to-Thursday week is expressed as plainly as a Monday-to-Friday one.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_work_calendars')) {
            return;
        }

        Schema::create('hr_work_calendars', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();

            $table->string('code', 30);
            $table->string('name', 120);
            $table->json('working_days');                 // ISO weekdays, e.g. [7,1,2,3,4]
            $table->time('default_start_time')->nullable();
            $table->time('default_end_time')->nullable();
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'code'], 'hr_calendar_code_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_work_calendars');
    }
};
