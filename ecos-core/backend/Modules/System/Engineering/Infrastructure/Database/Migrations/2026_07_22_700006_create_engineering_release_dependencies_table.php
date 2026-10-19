<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        if (Schema::hasTable('engineering_release_dependencies')) { return; }
        Schema::create('engineering_release_dependencies', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->uuid('release_id')->index();
            $table->string('dependency_type');
            $table->string('dependency_name');
            $table->string('dependency_version')->nullable();
            $table->string('status')->default('unresolved');
            $table->boolean('is_blocking')->default(true);
            $table->boolean('is_circular')->default(false);
            $table->text('resolution_notes')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->index(['release_id', 'dependency_type'], 'eng_rel_deps_release_type_idx');
        });
    }
    public function down(): void { Schema::dropIfExists('engineering_release_dependencies'); }
};
