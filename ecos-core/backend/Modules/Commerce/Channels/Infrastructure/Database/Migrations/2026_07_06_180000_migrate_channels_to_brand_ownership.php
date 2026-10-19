<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Backfill brand_id where still null using the company's first brand
        DB::statement(
            'UPDATE channels SET brand_id = ('
            .' SELECT id FROM brands WHERE company_id = channels.company_id'
            .' ORDER BY created_at ASC LIMIT 1'
            .') WHERE brand_id IS NULL',
        );

        // 2. Drop the old unique constraint [company_id, code]
        try {
            if (Schema::hasColumn('channels', 'brand_id')) {
                return;
            }

            Schema::table('channels', function (Blueprint $table): void {
                $table->dropUnique(['company_id', 'code']);
            });
        } catch (Exception) {
            // Constraint may already be gone (partial migration re-run)
        }

        // 3. Make brand_id required (NOT NULL) — must drop SET NULL FK first (MySQL rejects NOT NULL with SET NULL cascade)
        if (Schema::hasColumn('channels', 'brand_id')) {
            return;
        }

        Schema::table('channels', function (Blueprint $table): void {
            $table->dropForeign(['brand_id']);
        });
        if (Schema::hasColumn('channels', 'brand_id')) {
            return;
        }

        Schema::table('channels', function (Blueprint $table): void {
            $table->uuid('brand_id')->nullable(false)->change();
            $table->foreign('brand_id')->references('id')->on('brands')->cascadeOnDelete();
        });

        // 4. Add unique constraint [brand_id, code]
        try {
            if (Schema::hasColumn('channels', 'brand_id')) {
                return;
            }

            Schema::table('channels', function (Blueprint $table): void {
                $table->unique(['brand_id', 'code'], 'channels_brand_id_code_unique');
            });
        } catch (Exception) {
            // Constraint already exists
        }

        // 5. Drop company_id foreign key, index, and column
        if (Schema::hasColumn('channels', 'brand_id')) {
            return;
        }

        Schema::table('channels', function (Blueprint $table): void {
            $table->dropForeign(['company_id']);
            $table->dropIndex(['company_id']);
            $table->dropColumn('company_id');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('channels', 'brand_id')) {
            return;
        }

        Schema::table('channels', function (Blueprint $table): void {
            $table->dropUnique('channels_brand_id_code_unique');
        });

        if (Schema::hasColumn('channels', 'brand_id')) {
            return;
        }

        Schema::table('channels', function (Blueprint $table): void {
            $table->uuid('brand_id')->nullable()->change();
        });

        if (Schema::hasColumn('channels', 'brand_id')) {
            return;
        }

        Schema::table('channels', function (Blueprint $table): void {
            $table->foreignUuid('company_id')
                ->nullable()
                ->constrained('companies')
                ->cascadeOnDelete()
                ->after('id');
        });

        if (Schema::hasColumn('channels', 'brand_id')) {
            return;
        }

        Schema::table('channels', function (Blueprint $table): void {
            $table->index('company_id');
            $table->unique(['company_id', 'code']);
        });
    }
};
