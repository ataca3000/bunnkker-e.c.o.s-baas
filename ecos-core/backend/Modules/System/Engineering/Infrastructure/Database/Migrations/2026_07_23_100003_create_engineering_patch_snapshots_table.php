<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_patch_snapshots')) {
            return;
        }

        Schema::create('engineering_patch_snapshots', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('patch_id');
            $table->uuid('session_id');
            $table->uuid('company_id');
            $table->string('file_path');
            $table->longText('original_content')->nullable();
            $table->boolean('file_existed')->default(true);
            $table->boolean('is_restored')->default(false);
            $table->timestamp('restored_at')->nullable();
            $table->uuid('restored_by')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index('patch_id');
            $table->index('company_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_patch_snapshots');
    }
};
