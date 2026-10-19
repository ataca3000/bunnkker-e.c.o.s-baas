<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Link Campaigns to Initiatives.
 *
 * A Campaign may optionally belong to ONE Initiative.
 * A Campaign without an Initiative remains fully functional.
 * Campaigns are NOT duplicated — this is a nullable FK column.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('marketing_campaigns', 'marketing_initiative_id')) {
            return;
        }

        Schema::table('marketing_campaigns', function (Blueprint $table): void {
            $table->string('marketing_initiative_id', 36)
                ->nullable()
                ->after('company_id')
                ->index('mkt_camp_initiative_idx');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('marketing_campaigns', 'marketing_initiative_id')) {
            return;
        }

        Schema::table('marketing_campaigns', function (Blueprint $table): void {
            $table->dropIndex('mkt_camp_initiative_idx');
            $table->dropColumn('marketing_initiative_id');
        });
    }
};
