<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * GEO-005 — Official Egypt Geography Reference Dataset
 *
 * Phase A  Add iso_code to logistics_governorates (ISO 3166-2:EG)
 * Phase B  Correct 5 wrong governorate assignments (Cairo→Giza ×4, Alex→Beheira ×1)
 * Phase C  Remove 3 duplicate records (FK-safe: reassign then hard-delete)
 * Phase D  Standardise 19 names + remove 13 redundant "City" suffixes
 * Phase E  Add 6 missing official administrative centres
 *
 * FK tables: orders (SET NULL), brand_city_settings (CASCADE + unique), logistics_city_aliases (CASCADE)
 * All mutations journalled in geo005_audit_log.
 */
return new class extends Migration
{
    // ─── Entry points ────────────────────────────────────────────────────────

    public function up(): void
    {
        $this->createAuditTable();

        $this->phaseA_addIsoCodes();
        $this->phaseB_fixGovernorateAssignments();
        $this->phaseC_removeDuplicates();
        $this->phaseD_standardiseNames();
        $this->phaseE_addMissingCities();
    }

    public function down(): void
    {
        $entries = DB::table('geo005_audit_log')->orderByDesc('id')->get();

        foreach ($entries as $entry) {
            $before = $entry->before ? json_decode($entry->before, true) : [];
            $after = $entry->after ? json_decode($entry->after, true) : [];

            match ($entry->action) {
                'iso_code_set' => DB::table('logistics_governorates')
                    ->where('id', $entry->record_id)
                    ->update(['iso_code' => null]),

                'city_moved' => DB::table('logistics_cities')
                    ->where('id', $entry->record_id)
                    ->update(['governorate_id' => $before['governorate_id']]),

                'city_renamed' => DB::table('logistics_cities')
                    ->where('id', $entry->record_id)
                    ->update(['name_en' => $before['name_en'], 'name_ar' => $before['name_ar']]),

                'city_deleted' => DB::table('logistics_cities')->insert($before),

                'fk_orders' => DB::table('orders')
                    ->whereIn('id', $after['affected_ids'])
                    ->update(['logistics_city_id' => $after['from']]),

                'city_added' => DB::table('logistics_cities')->where('id', $entry->record_id)->delete(),

                default => null,
            };
        }

        Schema::dropIfExists('geo005_audit_log');

        if (Schema::hasColumn('logistics_governorates', 'iso_code')) {
            Schema::table('logistics_governorates', fn (Blueprint $t) => $t->dropColumn('iso_code'));
        }
    }

    // ─── Phase A: ISO 3166-2:EG codes ────────────────────────────────────────

    private function phaseA_addIsoCodes(): void
    {
        Schema::table('logistics_governorates', function (Blueprint $table) {
            $table->string('iso_code', 10)->nullable()->after('name_en');
        });

        $map = [
            'Cairo' => 'EG-C',
            'Alexandria' => 'EG-ALX',
            'Giza' => 'EG-GZ',
            'Qalyubia' => 'EG-KB',
            'Sharqia' => 'EG-SHR',
            'Dakahlia' => 'EG-DK',
            'Kafr El Sheikh' => 'EG-KFS',
            'Gharbia' => 'EG-GH',
            'Monufia' => 'EG-MNF',
            'Beheira' => 'EG-BH',
            'Ismailia' => 'EG-IS',
            'Suez' => 'EG-SUZ',
            'Port Said' => 'EG-PTS',
            'Damietta' => 'EG-DT',
            'Faiyum' => 'EG-FYM',
            'Beni Suef' => 'EG-BNS',
            'Minya' => 'EG-MN',
            'Asyut' => 'EG-AST',
            'Sohag' => 'EG-SHG',
            'Qena' => 'EG-KN',
            'Luxor' => 'EG-LX',
            'Aswan' => 'EG-ASN',
            'Red Sea' => 'EG-BA',
            'New Valley' => 'EG-WAD',
            'Matrouh' => 'EG-MT',
            'North Sinai' => 'EG-SIN',
            'South Sinai' => 'EG-JS',
        ];

        foreach ($map as $nameEn => $code) {
            $id = DB::table('logistics_governorates')->where('name_en', $nameEn)->value('id');
            if (! $id) {
                continue;
            }

            DB::table('logistics_governorates')->where('id', $id)->update(['iso_code' => $code]);
            $this->audit('iso_code_set', 'logistics_governorates', $id, ['iso_code' => null], ['iso_code' => $code]);
        }
    }

    // ─── Phase B: Fix wrong governorate assignments ───────────────────────────

    private function phaseB_fixGovernorateAssignments(): void
    {
        $cairoId = $this->govId('Cairo');
        $gizaId = $this->govId('Giza');
        $alexId = $this->govId('Alexandria');
        $behId = $this->govId('Beheira');

        $moves = [
            ['Dokki',            $cairoId, $gizaId],
            ['Agouza',           $cairoId, $gizaId],
            ['Imbaba',           $cairoId, $gizaId],
            ['El Haram',         $cairoId, $gizaId],
            ['Rashid (Rosetta)', $alexId,  $behId],
        ];

        foreach ($moves as [$nameEn, $fromGov, $toGov]) {
            $city = DB::table('logistics_cities')
                ->where('name_en', $nameEn)
                ->where('governorate_id', $fromGov)
                ->first();

            if (! $city) {
                continue;
            }

            DB::table('logistics_cities')->where('id', $city->id)->update(['governorate_id' => $toGov]);
            $this->audit('city_moved', 'logistics_cities', $city->id,
                ['governorate_id' => $fromGov, 'name_en' => $nameEn],
                ['governorate_id' => $toGov]);
        }
    }

    // ─── Phase C: Remove duplicate records ───────────────────────────────────

    private function phaseC_removeDuplicates(): void
    {
        $gizaId = $this->govId('Giza');
        $behId = $this->govId('Beheira');

        // "Dokki (Giza)" duplicates "Dokki" which was just moved to Giza from Cairo
        $this->mergeCity($this->cityId('Dokki', $gizaId), $this->cityId('Dokki (Giza)', $gizaId));

        // "Rashid (Rosetta)" was moved to Beheira — now duplicates "Rashid"
        $this->mergeCity($this->cityId('Rashid', $behId), $this->cityId('Rashid (Rosetta)', $behId));

        // "Pyramids Area" is an informal landmark; "El Haram" (now in Giza) is the official district
        $this->mergeCity($this->cityId('El Haram', $gizaId), $this->cityId('Pyramids Area', $gizaId));
    }

    /**
     * Reassign all FKs from duplicate → canonical, then hard-delete the duplicate.
     * Handles the unique(brand_id, city_id) constraint on brand_city_settings.
     */
    private function mergeCity(?int $canonicalId, ?int $duplicateId): void
    {
        if (! $canonicalId || ! $duplicateId) {
            return;
        }

        $duplicate = DB::table('logistics_cities')->where('id', $duplicateId)->first();
        if (! $duplicate) {
            return;
        }

        // orders — SET NULL semantics means we must explicitly update
        $affectedOrderIds = DB::table('orders')
            ->where('logistics_city_id', $duplicateId)
            ->pluck('id')
            ->toArray();

        if ($affectedOrderIds) {
            DB::table('orders')
                ->where('logistics_city_id', $duplicateId)
                ->update(['logistics_city_id' => $canonicalId]);

            $this->audit('fk_orders', 'orders', 0,
                ['logistics_city_id' => $duplicateId],
                ['from' => $duplicateId, 'to' => $canonicalId, 'affected_ids' => $affectedOrderIds]);
        }

        // brand_city_settings — unique(brand_id, city_id) requires care
        $brandRows = DB::table('brand_city_settings')->where('city_id', $duplicateId)->get();
        foreach ($brandRows as $row) {
            $hasCanonical = DB::table('brand_city_settings')
                ->where('brand_id', $row->brand_id)
                ->where('city_id', $canonicalId)
                ->exists();

            if ($hasCanonical) {
                DB::table('brand_city_settings')
                    ->where('brand_id', $row->brand_id)
                    ->where('city_id', $duplicateId)
                    ->delete();
            } else {
                DB::table('brand_city_settings')
                    ->where('brand_id', $row->brand_id)
                    ->where('city_id', $duplicateId)
                    ->update(['city_id' => $canonicalId]);
            }
        }

        // logistics_city_aliases — CASCADE, but update so aliases remain usable
        DB::table('logistics_city_aliases')
            ->where('city_id', $duplicateId)
            ->update(['city_id' => $canonicalId]);

        // Hard-delete duplicate
        $this->audit('city_deleted', 'logistics_cities', $duplicateId,
            (array) $duplicate, ['merged_into' => $canonicalId]);
        DB::table('logistics_cities')->where('id', $duplicateId)->delete();
    }

    // ─── Phase D: Standardise names ──────────────────────────────────────────

    private function phaseD_standardiseNames(): void
    {
        // [governorate_name_en, old_name_en, new_name_en, new_name_ar]
        $renames = [
            // CAPMAS spelling corrections
            ['Sharqia',        'Dirb Negm',                 'Deirb Negm',  'ديرب نجم'],
            ['Sharqia',        'Hehia',                      'Hihya',        'ههيا'],
            ['Kafr El Sheikh', 'Metoubes',                   'Matoubes',     'مطوبس'],
            ['Faiyum',         'Sinnuris',                   'Sannuris',     'سنورس'],
            ['New Valley',     'Paris (Baris)',               'Baris',        'بريس'],

            // Simplify compound bracket qualifier
            ['Cairo',          'New Cairo (5th Settlement)', 'New Cairo',    'التجمع الخامس'],

            // Remove redundant "City" suffix (13 entries)
            ['Ismailia',       'Ismailia City',    'Ismailia',  'الإسماعيلية'],
            ['Suez',           'Suez City',         'Suez',       'السويس'],
            ['Port Said',      'Port Said City',    'Port Said',  'بورسعيد'],
            ['Damietta',       'Damietta City',     'Damietta',   'دمياط'],
            ['Faiyum',         'Faiyum City',       'Faiyum',     'الفيوم'],
            ['Beni Suef',      'Beni Suef City',    'Beni Suef',  'بني سويف'],
            ['Minya',          'Minya City',        'Minya',      'المنيا'],
            ['Asyut',          'Asyut City',        'Asyut',      'أسيوط'],
            ['Sohag',          'Sohag City',        'Sohag',      'سوهاج'],
            ['Qena',           'Qena City',         'Qena',       'قنا'],
            ['Luxor',          'Luxor City',        'Luxor',      'الأقصر'],
            ['Aswan',          'Aswan City',        'Aswan',      'أسوان'],
            ['North Sinai',    'Arish City',        'El Arish',   'العريش'],
        ];

        foreach ($renames as [$govName, $oldNameEn, $newNameEn, $newNameAr]) {
            $govId = $this->govId($govName);
            if (! $govId) {
                continue;
            }

            $city = DB::table('logistics_cities')
                ->where('governorate_id', $govId)
                ->where('name_en', $oldNameEn)
                ->first();

            if (! $city) {
                continue;
            }

            DB::table('logistics_cities')
                ->where('id', $city->id)
                ->update(['name_en' => $newNameEn, 'name_ar' => $newNameAr]);

            $this->audit('city_renamed', 'logistics_cities', $city->id,
                ['name_en' => $city->name_en, 'name_ar' => $city->name_ar],
                ['name_en' => $newNameEn,      'name_ar' => $newNameAr]);
        }
    }

    // ─── Phase E: Add missing official administrative centres ─────────────────

    private function phaseE_addMissingCities(): void
    {
        // [gov_name_en, name_en, name_ar, display_order]
        $additions = [
            ['Cairo',      'El Nozha',          'النزهة',         24],
            ['Cairo',      'Rod El Farag',       'روض الفرج',      25],
            ['Cairo',      'El Basatin',         'البساتين',       26],
            ['Cairo',      '15th of May City',   'مدينة 15 مايو', 27],
            ['Giza',       'Boulaq El Dakrour',  'بولاق الدكرور', 16],
            ['Alexandria', 'El Montaza',         'المنتزه',        15],
        ];

        foreach ($additions as [$govName, $nameEn, $nameAr, $order]) {
            $govId = $this->govId($govName);
            if (! $govId) {
                continue;
            }

            if (DB::table('logistics_cities')
                ->where('governorate_id', $govId)
                ->where('name_en', $nameEn)
                ->exists()) {
                continue;
            }

            $id = DB::table('logistics_cities')->insertGetId([
                'governorate_id' => $govId,
                'name_en' => $nameEn,
                'name_ar' => $nameAr,
                'display_order' => $order,
                'is_active' => true,
                'is_system' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $this->audit('city_added', 'logistics_cities', $id,
                null, ['name_en' => $nameEn, 'governorate_id' => $govId]);
        }
    }

    // ─── Audit log ───────────────────────────────────────────────────────────

    private function createAuditTable(): void
    {
        if (Schema::hasTable('geo005_audit_log')) {
            return;
        }

        Schema::create('geo005_audit_log', function (Blueprint $table) {
            $table->id();
            $table->string('action', 30);
            $table->string('table_name', 60);
            $table->unsignedBigInteger('record_id');
            $table->json('before')->nullable();
            $table->json('after')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    private function audit(string $action, string $table, int $recordId, ?array $before, ?array $after): void
    {
        DB::table('geo005_audit_log')->insert([
            'action' => $action,
            'table_name' => $table,
            'record_id' => $recordId,
            'before' => $before !== null ? json_encode($before) : null,
            'after' => $after !== null ? json_encode($after) : null,
        ]);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private function govId(string $nameEn): ?int
    {
        return DB::table('logistics_governorates')->where('name_en', $nameEn)->value('id');
    }

    private function cityId(string $nameEn, ?int $govId): ?int
    {
        if (! $govId) {
            return null;
        }

        return DB::table('logistics_cities')
            ->where('name_en', $nameEn)
            ->where('governorate_id', $govId)
            ->value('id');
    }
};
