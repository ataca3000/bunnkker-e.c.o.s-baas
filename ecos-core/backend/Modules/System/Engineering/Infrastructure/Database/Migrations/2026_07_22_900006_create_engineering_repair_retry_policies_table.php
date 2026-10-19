<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_repair_retry_policies')) {
            return;
        }

        Schema::create('engineering_repair_retry_policies', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('name');
            $table->string('failure_type')->default('all');
            $table->unsignedInteger('max_retries')->default(3);
            $table->unsignedInteger('retry_delay_seconds')->default(60);
            $table->decimal('backoff_multiplier', 3, 2)->default(1.50);
            $table->unsignedInteger('timeout_seconds')->default(300);
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['company_id', 'failure_type', 'is_active'], 'eng_repair_retry_cid_type_active_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_repair_retry_policies');
    }
};
