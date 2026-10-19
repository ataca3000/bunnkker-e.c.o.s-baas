<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('automation_workflow_schedules')) {
            return;
        }

        Schema::create('automation_workflow_schedules', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('workflow_id')->index();
            $table->string('cron_expression', 100)->nullable();
            $table->string('timezone', 100)->default('UTC');
            $table->timestamp('next_run_at')->nullable()->index();
            $table->timestamp('last_run_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->string('created_by', 36);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('automation_workflow_schedules');
    }
};
