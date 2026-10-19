<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('pricing_reviews', 'trigger_reason')) {
            return;
        }

        Schema::table('pricing_reviews', function (Blueprint $table): void {
            if (! Schema::hasColumn('pricing_reviews', 'trigger_reason')) {
                $table->string('trigger_reason', 100)->nullable()->after('triggered_by_cost_history_id');
            }
            if (! Schema::hasColumn('pricing_reviews', 'trigger_source')) {
                $table->string('trigger_source', 255)->nullable()->after('trigger_reason');
            }
        });
    }

    public function down(): void
    {
        Schema::table('pricing_reviews', function (Blueprint $table): void {
            $table->dropColumn(array_filter(['trigger_reason', 'trigger_source'], fn ($col) => Schema::hasColumn('pricing_reviews', $col)));
        });
    }
};
