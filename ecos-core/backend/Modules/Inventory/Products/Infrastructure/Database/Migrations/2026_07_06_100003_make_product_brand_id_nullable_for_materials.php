<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ADR-013 correction: raw_material and packaging_material products belong directly
 * to a Company with no Brand layer. brand_id must be nullable at the schema level;
 * NOT NULL is enforced at the application layer for finished_good only.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Drop the existing RESTRICT FK, change column to nullable, re-add FK.
        if (Schema::hasColumn('products', 'brand_id')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            $table->dropForeign(['brand_id']);
        });

        if (Schema::hasColumn('products', 'brand_id')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            $table->uuid('brand_id')->nullable()->change();
            $table->foreign('brand_id')->references('id')->on('brands')->nullOnDelete();
        });
    }

    public function down(): void
    {
        // Reverse: make NOT NULL again (only safe if no nulls exist).
        if (Schema::hasColumn('products', 'brand_id')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            $table->dropForeign(['brand_id']);
        });

        if (Schema::hasColumn('products', 'brand_id')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            $table->uuid('brand_id')->nullable(false)->change();
            $table->foreign('brand_id')->references('id')->on('brands')->restrictOnDelete();
        });
    }
};
