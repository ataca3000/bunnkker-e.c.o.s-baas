<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * THE ANTI-DUPLICATION TABLE.
 *
 * A polymorphic reference to a row that already exists in V1 — a
 * distribution_zone, a logistics_city or a logistics_governorate. No place
 * name, no coordinate, no governorate string is copied.
 *
 * If this table ever grows a `city_name` or `latitude` column, Directive 8 has
 * been broken and the whole composition design has failed.
 *
 * The FK is deliberately application-level rather than a database constraint,
 * because member_id points at three different tables. CoverageResolverService
 * validates existence on write.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('network_service_area_members', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('service_area_id')
                ->constrained('network_service_areas')->cascadeOnDelete();

            $table->string('member_type', 20);      // CoverageMemberType
            $table->string('member_id', 36);        // BIGINT zone id or UUID city/gov id

            // Excluding a city from an otherwise-included zone is the common
            // real-world case (an island, a restricted compound), so exclusion
            // is first-class rather than requiring a second area.
            $table->boolean('is_excluded')->default(false);

            $table->unsignedBigInteger('added_by')->nullable();
            $table->timestamps();

            $table->unique(
                ['service_area_id', 'member_type', 'member_id'],
                'network_member_unique',
            );
            // The hot path: address → member → service area.
            $table->index(['member_type', 'member_id'], 'network_member_lookup_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('network_service_area_members');
    }
};
