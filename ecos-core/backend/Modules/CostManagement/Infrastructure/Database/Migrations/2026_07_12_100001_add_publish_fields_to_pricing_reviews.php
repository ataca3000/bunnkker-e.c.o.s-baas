<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('pricing_reviews', 'publish_status')) {
            return;
        }

        Schema::table('pricing_reviews', function (Blueprint $table) {
            // publish_status: null = pre-feature or rejected; pending_publish = approved but not yet live;
            //                 published = prices written to product catalog
            $table->string('publish_status', 20)->nullable()->after('resolved_at');
            $table->decimal('approved_price', 12, 4)->nullable()->after('publish_status');
            $table->decimal('approved_sale_price', 12, 4)->nullable()->after('approved_price');
            $table->timestamp('published_at')->nullable()->after('approved_sale_price');
        });
    }

    public function down(): void
    {
        Schema::table('pricing_reviews', function (Blueprint $table) {
            $table->dropColumn(['publish_status', 'approved_price', 'approved_sale_price', 'published_at']);
        });
    }
};
