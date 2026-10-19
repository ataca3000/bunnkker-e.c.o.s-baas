<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('automation_governance_policies')) {
            return;
        }

        Schema::create('automation_governance_policies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('company_id', 36)->nullable()->index();
            $table->string('name', 255);
            $table->text('description')->nullable();
            $table->unsignedInteger('max_executions_per_customer_per_day')->nullable();
            $table->unsignedInteger('max_executions_per_customer_per_workflow')->nullable();
            $table->unsignedBigInteger('max_total_executions_per_day')->nullable();
            $table->time('quiet_hours_start')->nullable();
            $table->time('quiet_hours_end')->nullable();
            $table->string('quiet_hours_timezone', 100)->nullable();
            $table->json('blacklisted_channels')->nullable();
            $table->json('opt_out_rules')->nullable();
            $table->json('allowed_action_types')->nullable();
            $table->boolean('requires_approval')->default(false);
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->string('created_by', 36);
            $table->string('updated_by', 36);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('automation_governance_policies');
    }
};
