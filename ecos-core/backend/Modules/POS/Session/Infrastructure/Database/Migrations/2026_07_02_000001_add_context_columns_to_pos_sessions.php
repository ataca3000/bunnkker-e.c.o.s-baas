<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pos_sessions', static function (Blueprint $table): void {
            if (! Schema::hasColumn('pos_sessions', 'company_id')) {
                $table->uuid('company_id')->nullable()->after('cashier_id');
                $table->index('company_id');
            }
            if (! Schema::hasColumn('pos_sessions', 'channel_id')) {
                $table->uuid('channel_id')->nullable()->after('company_id');
            }
            if (! Schema::hasColumn('pos_sessions', 'warehouse_id')) {
                $table->uuid('warehouse_id')->nullable()->after('channel_id');
                $table->index('warehouse_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('pos_sessions', static function (Blueprint $table): void {
            $table->dropIndex(['company_id']);
            $table->dropIndex(['warehouse_id']);
            $table->dropColumn(['company_id', 'channel_id', 'warehouse_id']);
        });
    }
};
