<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('cep_conversations', 'intent')) {
            return;
        }

        Schema::table('cep_conversations', function (Blueprint $table) {
            $table->string('intent')->default('general')->after('status');
            $table->boolean('is_vip')->default(false)->after('intent');
            $table->boolean('attribution_captured')->default(false)->after('is_vip');
            $table->uuid('order_id')->nullable()->after('attribution_captured');
            $table->uuid('quote_id')->nullable()->after('order_id');
            $table->string('country')->nullable()->after('language');
            $table->timestamp('last_order_at')->nullable();

            $table->index(['intent', 'company_id'], 'cep_cv_intent_co_idx');
            $table->index(['is_vip'], 'cep_cv_vip_idx');
        });
    }

    public function down(): void
    {
        Schema::table('cep_conversations', function (Blueprint $table) {
            $table->dropColumn(['intent', 'is_vip', 'attribution_captured', 'order_id', 'quote_id', 'country', 'last_order_at']);
        });
    }
};
