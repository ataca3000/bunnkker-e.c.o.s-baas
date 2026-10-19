<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_repair_patches')) {
            return;
        }

        Schema::create('engineering_repair_patches', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('session_id');
            $table->uuid('company_id');
            $table->unsignedBigInteger('response_id')->nullable();
            $table->longText('patch_content');
            $table->string('patch_format')->default('diff');
            $table->json('files_affected')->nullable();
            $table->unsignedInteger('lines_added')->default(0);
            $table->unsignedInteger('lines_removed')->default(0);
            $table->boolean('is_applied')->default(false);
            $table->timestamp('applied_at')->nullable();
            $table->uuid('applied_by')->nullable();
            $table->string('verification_status')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index('session_id');
            $table->index('company_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_repair_patches');
    }
};
