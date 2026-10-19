<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('automation_workflow_versions')) {
            return;
        }

        Schema::create('automation_workflow_versions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('workflow_id')->index();
            $table->unsignedInteger('version_number');
            $table->json('nodes_graph');
            $table->string('trigger_type', 30);
            $table->string('changed_by', 36);
            $table->string('change_note', 500)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['workflow_id', 'version_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('automation_workflow_versions');
    }
};
