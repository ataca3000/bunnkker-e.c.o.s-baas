<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Sales & Loyalty — EPIC C4. Loyalty programs and membership tiers.
 *
 * A program sets the earn rate (points per currency) and the redeem rate
 * (currency value per point). Tiers are membership levels reached by points
 * balance, each with an earn multiplier and benefits.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('crm_loyalty_programs')) {
            Schema::create('crm_loyalty_programs', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->uuid('company_id')->nullable();
                $table->string('name', 120);
                $table->decimal('points_per_currency', 12, 4)->default(1);   // earn: points per 1 currency
                $table->decimal('redeem_rate', 12, 6)->default(0.01);         // value: currency per point
                $table->char('currency', 3)->default('EGP');
                $table->boolean('is_active')->default(true);
                $table->timestamps();

                $table->index(['company_id', 'is_active'], 'crm_lprogram_company_idx');
            });
        }

        if (! Schema::hasTable('crm_loyalty_tiers')) {
            Schema::create('crm_loyalty_tiers', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('program_id')->constrained('crm_loyalty_programs')->cascadeOnDelete();
                $table->string('name', 80);
                $table->unsignedInteger('min_points')->default(0);
                $table->decimal('earn_multiplier', 6, 2)->default(1);
                $table->json('benefits')->nullable();
                $table->integer('order')->default(0);
                $table->timestamps();

                $table->index(['program_id', 'min_points'], 'crm_ltier_threshold_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_loyalty_tiers');
        Schema::dropIfExists('crm_loyalty_programs');
    }
};
