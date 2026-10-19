<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-IAM-003 / ADR-039 — immutable version history for Role Templates.
 * Snapshots are append-only; a published version is never mutated or deleted.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('role_template_versions')) {
            return;
        }

        Schema::create('role_template_versions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('role_template_id');
            $table->unsignedInteger('version');
            $table->string('key');            // snapshot of identity at version time
            $table->string('name');
            $table->string('category', 32);
            $table->string('status', 20);
            $table->json('definition');
            $table->text('change_note')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->foreign('role_template_id')->references('id')->on('role_templates')->cascadeOnDelete();
            $table->unique(['role_template_id', 'version']);
            $table->index('key');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('role_template_versions');
    }
};
