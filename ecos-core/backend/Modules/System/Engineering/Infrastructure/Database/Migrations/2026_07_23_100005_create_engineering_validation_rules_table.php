<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_validation_rules')) {
            return;
        }

        Schema::create('engineering_validation_rules', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('rule_type');                    // forbidden_path | forbidden_pattern | max_files | max_lines
            $table->string('name');
            $table->string('pattern')->nullable();
            $table->unsignedInteger('threshold')->nullable();
            $table->string('severity')->default('critical');
            $table->boolean('is_blocking')->default(true);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['company_id', 'rule_type', 'is_active'], 'eng_validation_rules_cid_type_active_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_validation_rules');
    }
};
