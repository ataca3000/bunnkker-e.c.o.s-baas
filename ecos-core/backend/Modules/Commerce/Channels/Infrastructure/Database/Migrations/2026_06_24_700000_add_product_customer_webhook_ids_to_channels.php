<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('channels', 'external_webhook_product_created_id')) {
            return;
        }

        Schema::table('channels', function (Blueprint $table): void {
            $table->string('external_webhook_product_created_id')->nullable()->after('external_webhook_order_updated_id');
            $table->string('external_webhook_product_updated_id')->nullable()->after('external_webhook_product_created_id');
            $table->string('external_webhook_product_deleted_id')->nullable()->after('external_webhook_product_updated_id');
            $table->string('external_webhook_customer_created_id')->nullable()->after('external_webhook_product_deleted_id');
            $table->string('external_webhook_customer_updated_id')->nullable()->after('external_webhook_customer_created_id');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('channels', 'external_webhook_product_created_id')) {
            return;
        }

        Schema::table('channels', function (Blueprint $table): void {
            $table->dropColumn([
                'external_webhook_product_created_id',
                'external_webhook_product_updated_id',
                'external_webhook_product_deleted_id',
                'external_webhook_customer_created_id',
                'external_webhook_customer_updated_id',
            ]);
        });
    }
};
