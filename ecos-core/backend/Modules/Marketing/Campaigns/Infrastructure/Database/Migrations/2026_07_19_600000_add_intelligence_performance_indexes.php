<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * RC-001 Performance hardening: add composite indexes on marketing_campaign_insights
 * to support the Intelligence layer's date-range + level + connection filter queries.
 *
 * All three new indexes are partial-composite — they cover the most frequent
 * query patterns in MarketingKpiEngine without duplicating the existing
 * (campaign_id, level, date_start, date_stop) and (level, date_start) indexes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('marketing_campaign_insights', function (Blueprint $table): void {
            $table->index(['marketing_connection_id', 'level', 'date_start'], 'mkt_ins_conn_level_date_idx');
            $table->index(['level', 'date_start', 'date_stop'], 'mkt_ins_level_date_range_idx');
        });
    }

    public function down(): void
    {
        Schema::table('marketing_campaign_insights', function (Blueprint $table): void {
            $table->dropIndex('mkt_ins_conn_level_date_idx');
            $table->dropIndex('mkt_ins_level_date_range_idx');
        });
    }
};
