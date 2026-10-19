<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_mapping_profiles')) {
            return;
        }

        Schema::create('marketing_mapping_profiles', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable()->index();
            $table->string('name', 200);
            $table->text('description')->nullable();
            $table->string('connector_type', 30)->nullable();        // null = applies to all connectors
            $table->boolean('is_active')->default(true);
            $table->boolean('auto_apply')->default(false);           // auto-apply when new assets discovered
            $table->uuid('created_by')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_mapping_profiles');
    }
};
