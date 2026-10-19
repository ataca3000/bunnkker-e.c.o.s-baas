<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F1. Cost centers.
 *
 * A financial DIMENSION, not a ledger. Cost centers tag journal lines so the
 * same account can be analysed by responsibility area — the multi-dimensional
 * approach (account × cost_center × branch × company) that keeps the Chart of
 * Accounts from exploding (ADR-F8).
 *
 * Company and Branch are existing org dimensions referenced by id on the line;
 * they are not re-modelled here. Cost center is the one new dimension Finance
 * owns. Profit-center / project / campaign columns live on the journal line as
 * nullable, so the architecture is ready without those tables existing yet.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_cost_centers', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');

            $table->string('code', 40);
            $table->string('name', 200);
            $table->string('name_ar', 200)->nullable();

            $table->foreignId('parent_id')->nullable()
                ->constrained('finance_cost_centers')->nullOnDelete();

            $table->boolean('is_active')->default(true);

            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'code'], 'finance_cc_company_code_unique');
            $table->index(['company_id', 'is_active'], 'finance_cc_company_active_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_cost_centers');
    }
};
