<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-ARCH-007 — User Preferences Foundation.
 *
 * One row per (user_id, category) pair. The `payload` column holds the entire
 * preference bag for that category as a JSON object so the schema never needs
 * to change when a category gains or loses keys.
 *
 * Known categories (from PreferenceCategory):
 *   products   — table columns, widths, density, sort, page size, filter presets
 *   orders     — same structure as products
 *   customers  — same
 *   suppliers  — same
 *   inventory  — same
 *   purchasing — same
 *   theme      — theme, language, timezone
 *   workspace  — default_company, default_branch, default_warehouse
 *
 * Any module may introduce its own category string without a schema change.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('user_preferences')) {
            return;
        }

        Schema::create('user_preferences', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            // The standard Laravel User model uses an auto-increment bigint PK.
            $table->unsignedBigInteger('user_id');
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();

            // Namespaced preference group: 'products', 'orders', 'theme', 'workspace', etc.
            // Max 150 chars leaves room for future sub-namespaces like 'reports.sales'.
            $table->string('category', 150);

            // Entire preference bag for this category.
            // The application layer guarantees this is always a valid JSON object.
            $table->json('payload');

            $table->timestamps();

            // A user has exactly one record per category.
            $table->unique(['user_id', 'category']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_preferences');
    }
};
