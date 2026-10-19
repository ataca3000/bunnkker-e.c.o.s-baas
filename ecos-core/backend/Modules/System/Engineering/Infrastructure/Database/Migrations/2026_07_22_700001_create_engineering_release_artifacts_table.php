<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        if (Schema::hasTable('engineering_release_artifacts')) { return; }
        Schema::create('engineering_release_artifacts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->uuid('release_id')->index();
            $table->uuid('task_id')->nullable()->index();
            $table->string('artifact_type');
            $table->string('name');
            $table->string('file_path')->nullable();
            $table->bigInteger('file_size_bytes')->default(0);
            $table->string('checksum')->nullable();
            $table->string('mime_type')->nullable();
            $table->json('metadata')->nullable();
            $table->uuid('uploaded_by')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('engineering_release_artifacts'); }
};
