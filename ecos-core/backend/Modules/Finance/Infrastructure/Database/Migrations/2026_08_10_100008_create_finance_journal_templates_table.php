<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F1. Journal templates.
 *
 * A reusable skeleton for recurring manual journals (accruals, depreciation,
 * standard reclasses). A template pre-fills a manual journal draft; it is never
 * itself a ledger record and posts nothing on its own. The lines are stored as
 * JSON because a template is configuration, not financial truth.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_journal_templates', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');

            $table->string('code', 40);
            $table->string('name', 200);
            $table->string('description', 500)->nullable();

            // [{ account_code, side: debit|credit, amount?: fixed, description? }, ...]
            $table->json('lines');

            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'code'], 'finance_jtpl_company_code_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_journal_templates');
    }
};
