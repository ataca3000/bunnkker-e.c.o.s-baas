<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_guardian_policies')) {
            return;
        }

        Schema::create('engineering_guardian_policies', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('name');
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_default')->default(false);
            $table->boolean('auto_repair')->default(true);
            $table->json('block_on')->nullable(); // categories that block; null = all
            $table->json('enabled_checks')->nullable(); // null = all checks
            $table->unsignedInteger('max_repair_attempts')->default(2);
            $table->boolean('require_revalidation')->default(true);
            $table->softDeletes();
            $table->timestamps();

            $table->index(['company_id', 'is_active', 'is_default'], 'eng_guardian_policies_cid_active_default_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_guardian_policies');
    }
};
