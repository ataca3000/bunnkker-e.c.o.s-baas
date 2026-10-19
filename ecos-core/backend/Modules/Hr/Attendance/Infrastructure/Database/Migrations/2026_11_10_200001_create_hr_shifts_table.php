<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H2. Work shifts.
 *
 * Named working windows — morning, evening, night. Deliberately `hr_shifts`: the
 * POS module already owns `pos_shifts`, which is a cash-register session and an
 * entirely different thing.
 *
 * A shift declares when work is expected. It does not accumulate hours, overtime
 * or time off in lieu — attendance here stays a record of what happened, not a
 * calculation of what it is worth.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_shifts')) {
            return;
        }

        Schema::create('hr_shifts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('work_calendar_id')->nullable()->constrained('hr_work_calendars')->nullOnDelete();

            $table->string('code', 30);
            $table->string('name', 120);
            $table->time('start_time');
            $table->time('end_time');
            $table->unsignedSmallInteger('break_minutes')->default(0);
            $table->boolean('crosses_midnight')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'code'], 'hr_shift_code_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_shifts');
    }
};
