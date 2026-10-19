<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('engineering_checklist_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('checklist_id');
            $table->uuid('company_id');
            $table->string('content', 500);
            $table->boolean('is_completed')->default(false);
            $table->uuid('completed_by_id')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->unsignedSmallInteger('position')->default(0);
            $table->softDeletes();
            $table->timestamps();

            $table->foreign('checklist_id')
                ->references('id')
                ->on('engineering_task_checklists')
                ->cascadeOnDelete();

            $table->index(['checklist_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_checklist_items');
    }
};
