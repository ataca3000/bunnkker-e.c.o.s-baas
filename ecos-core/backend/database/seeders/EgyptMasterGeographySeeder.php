<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Modules\Admin\Configuration\Domain\Models\MasterGovernorate;
use Modules\Admin\Configuration\Domain\Models\MasterZone;

/**
 * Seeds the permanent Egypt master geography dataset (27 governorates + all zones).
 * Idempotent — uses updateOrCreate; safe to re-run.
 * After seeding, links existing brand geography/zone records to master by name.
 * Generates permanent immutable zone codes (format: GOV_CODE-ABBR).
 *
 * Run: php artisan db:seed --class=EgyptMasterGeographySeeder
 */
class EgyptMasterGeographySeeder extends Seeder
{
    public function run(): void
    {
        $this->command->info('Seeding Egypt master geography…');

        foreach ($this->dataset() as $idx => $gov) {
            $masterGov = MasterGovernorate::updateOrCreate(
                ['name' => $gov['name']],
                [
                    'name_ar' => $gov['name_ar'],
                    'code' => $gov['code'],
                    'sort_order' => $idx,
                    'is_active' => true,
                    'is_archived' => false,
                ],
            );

            $usedCodes = [];

            // Collect existing codes to avoid regenerating on re-run
            MasterZone::where('master_governorate_id', $masterGov->id)
                ->whereNotNull('code')
                ->pluck('code')
                ->each(fn ($c) => $usedCodes[$c] = true);

            foreach ($gov['zones'] as $zoneIdx => $zoneName) {
                $existing = MasterZone::where([
                    'master_governorate_id' => $masterGov->id,
                    'name' => $zoneName,
                ])->first();

                if ($existing) {
                    // Ensure code is set (idempotent backfill for existing rows)
                    if (! $existing->code) {
                        $code = $this->makeZoneCode($gov['code'], $zoneName, $usedCodes);
                        $existing->update(['code' => $code]);
                    } else {
                        $usedCodes[$existing->code] = true;
                    }
                    $existing->update([
                        'sort_order' => $zoneIdx,
                        'is_active' => true,
                        'is_archived' => false,
                    ]);
                } else {
                    $code = $this->makeZoneCode($gov['code'], $zoneName, $usedCodes);
                    MasterZone::create([
                        'master_governorate_id' => $masterGov->id,
                        'name' => $zoneName,
                        'code' => $code,
                        'sort_order' => $zoneIdx,
                        'is_active' => true,
                        'is_archived' => false,
                    ]);
                }
            }

            $this->command->line("  ✓ {$gov['name']} (".count($gov['zones']).' zones)');
        }

        // Link existing brand geographies to master by name (case-insensitive)
        DB::statement('
            UPDATE config_delivery_geographies cdg
            INNER JOIN master_governorates mg ON LOWER(cdg.name) = LOWER(mg.name)
            SET cdg.master_governorate_id = mg.id
            WHERE cdg.master_governorate_id IS NULL
        ');

        // Link existing brand zones to master by name
        DB::statement('
            UPDATE config_delivery_zones cdz
            INNER JOIN master_zones mz ON LOWER(cdz.name) = LOWER(mz.name)
            SET cdz.master_zone_id = mz.id
            WHERE cdz.master_zone_id IS NULL
        ');

        // Auto-create brand zones for all geographies already linked to master
        $this->createMissingBrandZones();

        $this->command->info('Egypt master geography seeded. Existing records linked to master.');
    }

    /** Auto-create brand zones for existing brand geographies that have no zone records yet. */
    private function createMissingBrandZones(): void
    {
        $linked = \Modules\Admin\Configuration\Domain\Models\DeliveryGeography::whereNotNull('master_governorate_id')
            ->with('zones')
            ->get();

        $created = 0;
        foreach ($linked as $geo) {
            $masterZones = MasterZone::where(
                'master_governorate_id', $geo->master_governorate_id,
            )->orderBy('sort_order')->get();

            foreach ($masterZones as $mz) {
                $exists = \Modules\Admin\Configuration\Domain\Models\DeliveryZone::where([
                    'delivery_geography_id' => $geo->id,
                    'master_zone_id' => $mz->id,
                ])->exists();

                if (! $exists) {
                    \Modules\Admin\Configuration\Domain\Models\DeliveryZone::create([
                        'delivery_geography_id' => $geo->id,
                        'brand_id' => $geo->brand_id,
                        'master_zone_id' => $mz->id,
                        'name' => $mz->name,
                        'sort_order' => $mz->sort_order,
                        'is_active' => true,
                        'created_by' => $geo->created_by,
                        'updated_by' => $geo->updated_by,
                    ]);
                    $created++;
                }
            }
        }

        if ($created > 0) {
            $this->command->line("  ✓ Auto-created $created missing brand zone records");
        }
    }

    /**
     * Generate a permanent zone code from the governorate code + zone name abbreviation.
     * Format: GOV_CODE-ABBR (e.g. CAI-HEL, GIZ-DOK, ALX-SMO).
     * Resolves collisions by appending a number (CAI-EL2, CAI-EL3…).
     *
     * @param  array<string, bool>  $usedCodes  Passed by reference — updated in-place.
     */
    private function makeZoneCode(string $govCode, string $zoneName, array &$usedCodes): string
    {
        // Compact: remove spaces, uppercase, take first 3 chars
        $compact = preg_replace('/\s+/', '', strtoupper($zoneName)) ?? strtoupper($zoneName);
        $clean = preg_replace('/[^A-Z0-9]/', '', $compact) ?? $compact;
        $abbr = str_pad(substr($clean, 0, 3), 3, 'X');

        $code = $govCode.'-'.$abbr;
        $n = 2;
        while (isset($usedCodes[$code])) {
            $code = $govCode.'-'.substr($abbr, 0, 2).$n;
            $n++;
        }
        $usedCodes[$code] = true;

        return $code;
    }

    /** @return list<array{name: string, name_ar: string, code: string, zones: list<string>}> */
    private function dataset(): array
    {
        return [
            // ── Greater Cairo ─────────────────────────────────────────────────
            [
                'name' => 'Cairo', 'name_ar' => 'القاهرة', 'code' => 'CAI',
                'zones' => [
                    'Nasr City', 'Maadi', 'Heliopolis', 'Mokattam', 'New Cairo',
                    'El Nozha', 'Shorouk City', 'Obour City', 'El Rehab', 'Badr City',
                    'Zaytoun', 'Shubra', 'Ain Shams', 'Fifth Settlement', 'Downtown Cairo',
                    'Garden City', 'Zamalek',
                ],
            ],
            [
                'name' => 'Giza', 'name_ar' => 'الجيزة', 'code' => 'GIZ',
                'zones' => [
                    'Dokki', 'Mohandessin', 'Haram', 'Faisal', '6th October City',
                    'Sheikh Zayed', 'Agouza', 'Imbaba', 'Hadaiq Al Ahram',
                    'Bulaq Al Dakrour', 'Giza City',
                ],
            ],
            [
                'name' => 'Qalyubia', 'name_ar' => 'القليوبية', 'code' => 'QAL',
                'zones' => ['Benha', 'Qalyub', 'Khanka', 'Shoubra El Kheima', 'Qanatir'],
            ],
            // ── Alexandria Region ─────────────────────────────────────────────
            [
                'name' => 'Alexandria', 'name_ar' => 'الإسكندرية', 'code' => 'ALX',
                'zones' => [
                    'Smouha', 'Sidi Gaber', 'Miami', 'Mandara', 'Agami', 'Gleem',
                    'San Stefano', 'Sidi Bishr', 'Montazah', 'Stanley', 'Kafr Abdo', 'Sporting',
                ],
            ],
            [
                'name' => 'Beheira', 'name_ar' => 'البحيرة', 'code' => 'BHR',
                'zones' => ['Damanhour', 'Kafr El Dawwar', 'Hosh Issa', 'Abu Qir', 'Rashid'],
            ],
            [
                'name' => 'Matruh', 'name_ar' => 'مطروح', 'code' => 'MAT',
                'zones' => ['Marsa Matruh', 'Sidi Barrani', 'Siwa', 'El Alamein', 'Sollum'],
            ],
            // ── Nile Delta ────────────────────────────────────────────────────
            [
                'name' => 'Dakahlia', 'name_ar' => 'الدقهلية', 'code' => 'DAK',
                'zones' => ['Mansoura', 'Talkha', 'Mit Ghamr', 'Aga', 'Sherbin', 'Dekerness'],
            ],
            [
                'name' => 'Sharqia', 'name_ar' => 'الشرقية', 'code' => 'SHA',
                'zones' => [
                    'Zagazig', '10th of Ramadan City', 'Bilbeis', 'Minya El Qamh', 'Abu Hammad',
                ],
            ],
            [
                'name' => 'Gharbia', 'name_ar' => 'الغربية', 'code' => 'GHR',
                'zones' => ['Tanta', 'Mahalla El Kubra', 'Kafr El Zayat', 'Zefta', 'Samanoud'],
            ],
            [
                'name' => 'Monufia', 'name_ar' => 'المنوفية', 'code' => 'MON',
                'zones' => ['Shibin El Kom', 'Menouf', 'Quesna', 'Berket El Sab', 'Ashmoun'],
            ],
            [
                'name' => 'Kafr El-Sheikh', 'name_ar' => 'كفر الشيخ', 'code' => 'KFS',
                'zones' => ['Kafr El-Sheikh City', 'Desouk', 'Sidi Salem', 'Fuwwah', 'Burullus'],
            ],
            [
                'name' => 'Damietta', 'name_ar' => 'دمياط', 'code' => 'DAM',
                'zones' => ['Damietta City', 'New Damietta', 'Ras El Bar', 'Kafr Saad'],
            ],
            // ── Canal Zone ────────────────────────────────────────────────────
            [
                'name' => 'Port Said', 'name_ar' => 'بورسعيد', 'code' => 'PRT',
                'zones' => ['Port Said City', 'Port Fouad', 'El Arab', 'El Manakh'],
            ],
            [
                'name' => 'Ismailia', 'name_ar' => 'الإسماعيلية', 'code' => 'ISM',
                'zones' => ['Ismailia City', 'Fayid', 'Abu Sultan', 'Tel El Kebir'],
            ],
            [
                'name' => 'Suez', 'name_ar' => 'السويس', 'code' => 'SUZ',
                'zones' => ['Suez City', 'El Arbaeen', 'El Ganayen'],
            ],
            // ── Upper Egypt (North) ───────────────────────────────────────────
            [
                'name' => 'Faiyum', 'name_ar' => 'الفيوم', 'code' => 'FAI',
                'zones' => ['Fayoum City', 'Sinnuris', 'Tamiya', 'Ibsheway'],
            ],
            [
                'name' => 'Beni Suef', 'name_ar' => 'بني سويف', 'code' => 'BNS',
                'zones' => ['Beni Suef City', 'El Wasta', 'Nasser', 'Ihnasya'],
            ],
            [
                'name' => 'Minya', 'name_ar' => 'المنيا', 'code' => 'MIN',
                'zones' => ['Minya City', 'Abu Qurqas', 'Mallawi', 'Samalut', 'Matai'],
            ],
            // ── Upper Egypt (South) ───────────────────────────────────────────
            [
                'name' => 'Asyut', 'name_ar' => 'أسيوط', 'code' => 'ASY',
                'zones' => ['Asyut City', 'Dairut', 'Manfalut', 'Abnub'],
            ],
            [
                'name' => 'Sohag', 'name_ar' => 'سوهاج', 'code' => 'SOH',
                'zones' => ['Sohag City', 'Akhmim', 'Tahta', 'Girga'],
            ],
            [
                'name' => 'Qena', 'name_ar' => 'قنا', 'code' => 'QNA',
                'zones' => ['Qena City', 'Nag Hammadi', 'Dishna', 'Qus'],
            ],
            [
                'name' => 'Luxor', 'name_ar' => 'الأقصر', 'code' => 'LUX',
                'zones' => ['Luxor City', 'Esna', 'Luxor East Bank', 'Luxor West Bank'],
            ],
            [
                'name' => 'Aswan', 'name_ar' => 'أسوان', 'code' => 'ASW',
                'zones' => ['Aswan City', 'Kom Ombo', 'Edfu', 'Daraw'],
            ],
            // ── Remote / Border ───────────────────────────────────────────────
            [
                'name' => 'Red Sea', 'name_ar' => 'البحر الأحمر', 'code' => 'RED',
                'zones' => ['Hurghada', 'Marsa Alam', 'El Gouna', 'Safaga', 'El Quseir'],
            ],
            [
                'name' => 'New Valley', 'name_ar' => 'الوادي الجديد', 'code' => 'NVL',
                'zones' => ['Kharga', 'Dakhla', 'Farafra', 'Mut', 'El Balat'],
            ],
            [
                'name' => 'North Sinai', 'name_ar' => 'شمال سيناء', 'code' => 'NSI',
                'zones' => ['Arish', 'Sheikh Zuwayed', 'Bir al-Abed', 'Rafah', 'El Hasana'],
            ],
            [
                'name' => 'South Sinai', 'name_ar' => 'جنوب سيناء', 'code' => 'SSI',
                'zones' => ['Sharm El Sheikh', 'Dahab', 'Nuweiba', 'Taba', 'St. Catherine'],
            ],
        ];
    }
}
