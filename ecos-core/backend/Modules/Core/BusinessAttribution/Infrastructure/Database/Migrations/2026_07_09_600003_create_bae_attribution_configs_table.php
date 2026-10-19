<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('bae_attribution_configs')) {
            return;
        }

        Schema::create('bae_attribution_configs', static function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->uuid('company_id');
            $table->string('model', 50);            // AttributionModel enum value
            $table->json('config')->nullable();      // model-specific weights/parameters
            $table->boolean('is_default')->default(false);

            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestamps();

            $table->index('company_id', 'bae_ac_co_idx');
            $table->index(['company_id', 'is_default'], 'bae_ac_co_def_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bae_attribution_configs');
    }
};
