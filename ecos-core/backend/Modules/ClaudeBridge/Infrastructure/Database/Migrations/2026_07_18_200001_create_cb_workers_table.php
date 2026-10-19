<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('cb_workers')) {
            return;
        }

        Schema::create('cb_workers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('name', 100);
            $table->string('hostname', 255);
            $table->string('token_hash', 255);
            $table->enum('status', ['online', 'offline'])->default('offline');
            $table->timestamp('last_seen_at')->nullable();
            $table->string('claude_version', 50)->nullable();
            $table->timestamp('registered_at');
            $table->uuid('registered_by');
            $table->boolean('is_active')->default(true);

            $table->index('company_id', 'idx_cb_workers_company');
            $table->index('status', 'idx_cb_workers_status');

            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cb_workers');
    }
};
