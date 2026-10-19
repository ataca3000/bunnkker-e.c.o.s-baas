<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('automation_workflow_templates')) {
            return;
        }

        Schema::create('automation_workflow_templates', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name', 255);
            $table->text('description')->nullable();
            $table->string('category', 50)->index();
            $table->string('trigger_type', 30);
            $table->json('nodes_graph');
            $table->string('company_id', 36)->nullable()->index();
            $table->boolean('is_global')->default(false)->index();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('usage_count')->default(0);
            $table->string('created_by', 36);
            $table->string('updated_by', 36);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('automation_workflow_templates');
    }
};
