<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_mapping_profile_rules')) {
            return;
        }

        Schema::create('marketing_mapping_profile_rules', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('mapping_profile_id')->index();
            $table->string('match_field', 50);                       // name | name_contains | external_id | asset_type
            $table->string('match_value', 500);
            $table->string('related_type', 30);                      // company | brand | channel | team
            $table->uuid('related_id');
            $table->integer('priority')->default(0);
            $table->timestamps();

            $table->foreign('mapping_profile_id')
                ->references('id')->on('marketing_mapping_profiles')
                ->onDelete('cascade');

            $table->index(['mapping_profile_id', 'priority'], 'mkt_map_rule_profile_priority_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_mapping_profile_rules');
    }
};
