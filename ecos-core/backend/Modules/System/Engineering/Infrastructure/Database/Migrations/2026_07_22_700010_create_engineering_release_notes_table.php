<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        if (Schema::hasTable('engineering_release_notes')) { return; }
        Schema::create('engineering_release_notes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->uuid('release_id')->index();
            $table->string('note_type')->default('general');
            $table->string('section')->nullable();
            $table->text('content');
            $table->boolean('is_public')->default(false);
            $table->boolean('is_pinned')->default(false);
            $table->uuid('authored_by')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('engineering_release_notes'); }
};
