<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('channels', 'sync_customers')) {
            return;
        }

        Schema::table('channels', function (Blueprint $table): void {
            $table->boolean('sync_customers')->default(true)->after('sync_stock');
            $table->string('external_webhook_order_created_id')->nullable()->after('sync_customers');
            $table->string('external_webhook_order_updated_id')->nullable()->after('external_webhook_order_created_id');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('channels', 'sync_customers')) {
            return;
        }

        Schema::table('channels', function (Blueprint $table): void {
            $table->dropColumn([
                'sync_customers',
                'external_webhook_order_created_id',
                'external_webhook_order_updated_id',
            ]);
        });
    }
};
