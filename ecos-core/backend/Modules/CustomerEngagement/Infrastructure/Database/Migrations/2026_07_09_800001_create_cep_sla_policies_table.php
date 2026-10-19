<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('cep_sla_policies')) {
            return;
        }

        Schema::create('cep_sla_policies', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable()->index();
            $table->string('name');
            $table->unsignedInteger('first_response_minutes')->default(60);
            $table->unsignedInteger('resolution_minutes')->default(1440);
            $table->boolean('business_hours_only')->default(false);
            $table->boolean('is_default')->default(false);
            $table->json('config')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'is_default'], 'cep_sla_co_def_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cep_sla_policies');
    }
};
