<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Service levels (same-day, next-day, scheduled) and the coverage rules that
 * bind a level to an area: cutoff, lead time and surcharge.
 *
 * A level exists once per company; a rule exists per (area × level), so the same
 * "Same Day" promise can have a 14:00 cutoff in Cairo and 11:00 in Alexandria
 * without duplicating the level itself.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('network_service_levels', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();

            $table->string('code', 40);
            $table->string('name', 150);
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('target_hours')->default(24);
            $table->unsignedSmallInteger('display_order')->default(0);
            $table->boolean('is_active')->default(true);

            $table->timestamps();

            $table->unique(['company_id', 'code'], 'network_level_company_code_unique');
        });

        Schema::create('network_coverage_rules', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('service_area_id')
                ->constrained('network_service_areas')->cascadeOnDelete();
            $table->foreignId('service_level_id')
                ->constrained('network_service_levels')->cascadeOnDelete();

            // Orders placed after this local time roll to the next day.
            $table->time('cutoff_time')->nullable();
            $table->unsignedSmallInteger('lead_time_hours')->default(24);
            $table->decimal('surcharge', 12, 2)->nullable();
            $table->string('currency', 3)->nullable();

            // Bitmask-free day availability: seven booleans read far better in
            // a query plan and in a UI than a packed integer.
            $table->boolean('serves_sunday')->default(true);
            $table->boolean('serves_monday')->default(true);
            $table->boolean('serves_tuesday')->default(true);
            $table->boolean('serves_wednesday')->default(true);
            $table->boolean('serves_thursday')->default(true);
            $table->boolean('serves_friday')->default(false);
            $table->boolean('serves_saturday')->default(true);

            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(
                ['service_area_id', 'service_level_id'],
                'network_rule_area_level_unique',
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('network_coverage_rules');
        Schema::dropIfExists('network_service_levels');
    }
};
