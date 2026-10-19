<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('configuration_versions')) {
            return;
        }

        Schema::create('configuration_versions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->restrictOnDelete();
            $table->string('version_label', 50)->nullable();
            $table->boolean('is_active')->default(false);
            $table->json('configuration')->nullable();
            $table->text('notes')->nullable();
            $table->timestampsTz();
            $table->uuid('created_by')->nullable();

            $table->index(['company_id', 'is_active'], 'idx_configuration_versions_company_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('configuration_versions');
    }
};
