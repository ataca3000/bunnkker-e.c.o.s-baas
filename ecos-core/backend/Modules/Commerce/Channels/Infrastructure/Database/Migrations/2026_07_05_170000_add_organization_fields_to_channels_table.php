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
        Schema::table('channels', function (Blueprint $table): void {
            // Guard each column — this migration may have run partially
            if (! Schema::hasColumn('channels', 'code')) {
                $table->string('code', 20)->nullable()->after('company_id');
            }
            if (! Schema::hasColumn('channels', 'channel_type')) {
                $table->string('channel_type', 50)->nullable()->after('name');
            }
            if (! Schema::hasColumn('channels', 'channel_role')) {
                $table->string('channel_role', 50)->nullable()->after('channel_type');
            }
            if (! Schema::hasColumn('channels', 'brand_id')) {
                $table->foreignUuid('brand_id')->nullable()->constrained('brands')->nullOnDelete()->after('company_id');
            }
            if (! Schema::hasColumn('channels', 'business_account_id')) {
                $table->foreignUuid('business_account_id')->nullable()->constrained('business_accounts')->nullOnDelete()->after('brand_id');
            }
        });

        // Backfill codes for existing channels — MySQL-compatible JOIN UPDATE with subquery
        DB::statement("
            UPDATE channels
            JOIN (
                SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY created_at) AS rn
                FROM channels
                WHERE code IS NULL
            ) ranked ON channels.id = ranked.id
            SET channels.code = CONCAT('CH-', LPAD(ranked.rn, 6, '0'))
        ");

        // Make code unique per company (guard if already added in a prior partial run)
        try {
            Schema::table('channels', function (Blueprint $table): void {
                $table->unique(['company_id', 'code']);
            });
        } catch (Exception) {
            // Unique constraint already exists
        }
    }

    public function down(): void
    {
        Schema::table('channels', function (Blueprint $table): void {
            $table->dropForeign(['brand_id']);
            $table->dropForeign(['business_account_id']);
            $table->dropUnique(['company_id', 'code']);
            $table->dropColumn(['code', 'channel_type', 'channel_role', 'brand_id', 'business_account_id']);
        });
    }
};
