<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Official Egypt geography seed — 27 governorates, corrected city lists.
 *
 * Reflects GEO-005 corrections:
 *   - Dokki / Agouza / Imbaba / El Haram moved from Cairo → Giza
 *   - Rashid (Rosetta) removed from Alexandria (canonical entry is in Beheira)
 *   - "Dokki (Giza)" and "Pyramids Area" removed from Giza (merged into canonical records)
 *   - 5 spelling fixes, 13 redundant "City" suffixes removed
 *   - 6 missing official cities added
 *   - ISO 3166-2:EG codes on every governorate
 *
 * Idempotent: upsert on name_en per governorate for govs; insert-if-not-exists for cities.
 * Run after migration 2026_07_16_000010_geo005_correct_egypt_geography.php on existing installs.
 */
class EgyptGeographySeeder extends Seeder
{
    public function run(): void
    {
        $hasIsoCode = Schema::hasColumn('logistics_governorates', 'iso_code');

        foreach ($this->governorateData() as $govData) {
            $cities = $govData['cities'];
            unset($govData['cities']);

            $govId = DB::table('logistics_governorates')
                ->where('name_en', $govData['name_en'])
                ->where('country_id', 1)
                ->value('id');

            $updatePayload = [
                'name_ar' => $govData['name_ar'],
                'default_shipping_price' => $govData['default_shipping_price'],
                'display_order' => $govData['display_order'],
                'is_system' => true,
                'updated_at' => now(),
            ];

            if ($hasIsoCode) {
                $updatePayload['iso_code'] = $govData['iso_code'];
            }

            if ($govId) {
                DB::table('logistics_governorates')->where('id', $govId)->update($updatePayload);
            } else {
                $insertPayload = array_merge($govData, [
                    'country_id' => 1,
                    'is_active' => true,
                    'is_system' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                if (! $hasIsoCode) {
                    unset($insertPayload['iso_code']);
                }

                $govId = DB::table('logistics_governorates')->insertGetId($insertPayload);
            }

            foreach ($cities as $order => $city) {
                $exists = DB::table('logistics_cities')
                    ->where('governorate_id', $govId)
                    ->where('name_en', $city['name_en'])
                    ->exists();

                if (! $exists) {
                    DB::table('logistics_cities')->insert([
                        'governorate_id' => $govId,
                        'name_ar' => $city['name_ar'],
                        'name_en' => $city['name_en'],
                        'shipping_price' => null,
                        'display_order' => $order + 1,
                        'is_active' => true,
                        'is_system' => true,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        }
    }

    private function governorateData(): array
    {
        return [
            // ── Cairo (القاهرة) ── EG-C ─────────────────────────────────────────
            // Note: Dokki / Agouza / Imbaba / El Haram are in Giza (correct gov).
            [
                'name_en' => 'Cairo', 'name_ar' => 'القاهرة', 'iso_code' => 'EG-C',
                'default_shipping_price' => 35.00, 'display_order' => 1,
                'cities' => [
                    ['name_en' => 'Nasr City',         'name_ar' => 'مدينة نصر'],
                    ['name_en' => 'Maadi',              'name_ar' => 'المعادي'],
                    ['name_en' => 'Heliopolis',         'name_ar' => 'مصر الجديدة'],
                    ['name_en' => 'Zaytoun',            'name_ar' => 'الزيتون'],
                    ['name_en' => 'Shubra',             'name_ar' => 'شبرا'],
                    ['name_en' => 'El Matareyya',       'name_ar' => 'المطرية'],
                    ['name_en' => 'Helwan',             'name_ar' => 'حلوان'],
                    ['name_en' => 'Ain Shams',          'name_ar' => 'عين شمس'],
                    ['name_en' => 'New Cairo',          'name_ar' => 'التجمع الخامس'],
                    ['name_en' => 'Zamalek',            'name_ar' => 'الزمالك'],
                    ['name_en' => 'Downtown Cairo',     'name_ar' => 'وسط البلد'],
                    ['name_en' => 'El Marg',            'name_ar' => 'المرج'],
                    ['name_en' => 'Old Cairo',          'name_ar' => 'مصر القديمة'],
                    ['name_en' => 'El Moqattam',        'name_ar' => 'المقطم'],
                    ['name_en' => 'Abdin',              'name_ar' => 'عابدين'],
                    ['name_en' => 'El Ataba',           'name_ar' => 'العتبة'],
                    ['name_en' => 'Badr City',          'name_ar' => 'مدينة بدر'],
                    ['name_en' => 'Shorouk City',       'name_ar' => 'مدينة الشروق'],
                    ['name_en' => 'Obour City',         'name_ar' => 'مدينة العبور'],
                    ['name_en' => 'El Nozha',           'name_ar' => 'النزهة'],
                    ['name_en' => 'Rod El Farag',       'name_ar' => 'روض الفرج'],
                    ['name_en' => 'El Basatin',         'name_ar' => 'البساتين'],
                    ['name_en' => '15th of May City',   'name_ar' => 'مدينة 15 مايو'],
                ],
            ],

            // ── Alexandria (الإسكندرية) ── EG-ALX ─────────────────────────────
            // Note: Rashid (Rosetta) is in Beheira — removed from this list.
            [
                'name_en' => 'Alexandria', 'name_ar' => 'الإسكندرية', 'iso_code' => 'EG-ALX',
                'default_shipping_price' => 45.00, 'display_order' => 2,
                'cities' => [
                    ['name_en' => 'Moharam Bek',    'name_ar' => 'محرم بك'],
                    ['name_en' => 'Bakos',          'name_ar' => 'باكوس'],
                    ['name_en' => 'El Mansheyya',   'name_ar' => 'المنشية'],
                    ['name_en' => 'Sidi Bishr',     'name_ar' => 'سيدي بشر'],
                    ['name_en' => 'El Gomrok',      'name_ar' => 'الجمرك'],
                    ['name_en' => 'El Labban',      'name_ar' => 'اللبان'],
                    ['name_en' => 'El Maamoura',    'name_ar' => 'المعمورة'],
                    ['name_en' => 'El Agami',       'name_ar' => 'العجمي'],
                    ['name_en' => 'Borg El Arab',   'name_ar' => 'برج العرب'],
                    ['name_en' => 'El Dekheila',    'name_ar' => 'الدخيلة'],
                    ['name_en' => 'Karmouz',        'name_ar' => 'كرموز'],
                    ['name_en' => 'Smouha',         'name_ar' => 'سموحة'],
                    ['name_en' => 'Miami',          'name_ar' => 'ميامي'],
                    ['name_en' => 'El Montaza',     'name_ar' => 'المنتزه'],
                ],
            ],

            // ── Giza (الجيزة) ── EG-GZ ──────────────────────────────────────────
            // Receives: Dokki / Agouza / Imbaba / El Haram (moved from Cairo by migration).
            // Removed: Dokki (Giza) [merged → Dokki], Pyramids Area [merged → El Haram].
            [
                'name_en' => 'Giza', 'name_ar' => 'الجيزة', 'iso_code' => 'EG-GZ',
                'default_shipping_price' => 35.00, 'display_order' => 3,
                'cities' => [
                    ['name_en' => 'Dokki',             'name_ar' => 'الدقي'],
                    ['name_en' => 'Agouza',            'name_ar' => 'العجوزة'],
                    ['name_en' => 'Imbaba',            'name_ar' => 'إمبابة'],
                    ['name_en' => 'El Haram',          'name_ar' => 'الهرم'],
                    ['name_en' => 'Mohandessin',       'name_ar' => 'المهندسين'],
                    ['name_en' => 'Faisal',            'name_ar' => 'فيصل'],
                    ['name_en' => 'Omraneya',          'name_ar' => 'العمرانية'],
                    ['name_en' => 'Giza City Center',  'name_ar' => 'وسط الجيزة'],
                    ['name_en' => '6th October City',  'name_ar' => 'مدينة ٦ أكتوبر'],
                    ['name_en' => 'Sheikh Zayed',      'name_ar' => 'الشيخ زايد'],
                    ['name_en' => 'Hadayek El Ahram',  'name_ar' => 'حدائق الأهرام'],
                    ['name_en' => 'Bahariya Oasis',    'name_ar' => 'الواحات البحرية'],
                    ['name_en' => 'Boulaq El Dakrour', 'name_ar' => 'بولاق الدكرور'],
                ],
            ],

            // ── Qalyubia (القليوبية) ── EG-KB ────────────────────────────────────
            [
                'name_en' => 'Qalyubia', 'name_ar' => 'القليوبية', 'iso_code' => 'EG-KB',
                'default_shipping_price' => 40.00, 'display_order' => 4,
                'cities' => [
                    ['name_en' => 'Banha',                 'name_ar' => 'بنها'],
                    ['name_en' => 'Shubra El Kheima',      'name_ar' => 'شبرا الخيمة'],
                    ['name_en' => 'Qalyub',                'name_ar' => 'قليوب'],
                    ['name_en' => 'El Khanka',             'name_ar' => 'الخانكة'],
                    ['name_en' => 'El Khusous',            'name_ar' => 'الخصوص'],
                    ['name_en' => 'El Qanater El Khairia', 'name_ar' => 'القناطر الخيرية'],
                    ['name_en' => 'Toukh',                 'name_ar' => 'طوخ'],
                    ['name_en' => 'Shebin El Qanatir',     'name_ar' => 'شبين القناطر'],
                    ['name_en' => 'Abu Zaabal',            'name_ar' => 'أبو زعبل'],
                ],
            ],

            // ── Sharqia (الشرقية) ── EG-SHR ──────────────────────────────────────
            // Fixed: Dirb Negm → Deirb Negm, Hehia → Hihya (CAPMAS official spellings)
            [
                'name_en' => 'Sharqia', 'name_ar' => 'الشرقية', 'iso_code' => 'EG-SHR',
                'default_shipping_price' => 50.00, 'display_order' => 5,
                'cities' => [
                    ['name_en' => 'Zagazig',               'name_ar' => 'الزقازيق'],
                    ['name_en' => '10th of Ramadan',       'name_ar' => 'العاشر من رمضان'],
                    ['name_en' => 'Bilbeis',               'name_ar' => 'بلبيس'],
                    ['name_en' => 'Abu Kebir',             'name_ar' => 'أبو كبير'],
                    ['name_en' => 'Deirb Negm',            'name_ar' => 'ديرب نجم'],
                    ['name_en' => 'El Salehiya El Gedida', 'name_ar' => 'الصالحية الجديدة'],
                    ['name_en' => 'Minya El Qamh',         'name_ar' => 'منيا القمح'],
                    ['name_en' => 'Faqous',                'name_ar' => 'فاقوس'],
                    ['name_en' => 'Hihya',                 'name_ar' => 'ههيا'],
                ],
            ],

            // ── Dakahlia (الدقهلية) ── EG-DK ─────────────────────────────────────
            [
                'name_en' => 'Dakahlia', 'name_ar' => 'الدقهلية', 'iso_code' => 'EG-DK',
                'default_shipping_price' => 55.00, 'display_order' => 6,
                'cities' => [
                    ['name_en' => 'Mansoura',        'name_ar' => 'المنصورة'],
                    ['name_en' => 'Talkha',          'name_ar' => 'طلخا'],
                    ['name_en' => 'Mit Ghamr',       'name_ar' => 'ميت غمر'],
                    ['name_en' => 'Dekernes',        'name_ar' => 'دكرنس'],
                    ['name_en' => 'El Sinbillaween', 'name_ar' => 'السنبلاوين'],
                    ['name_en' => 'Minyet El Nasr',  'name_ar' => 'منية النصر'],
                    ['name_en' => 'El Manzala',      'name_ar' => 'المنزلة'],
                    ['name_en' => 'Sherbin',         'name_ar' => 'شربين'],
                ],
            ],

            // ── Kafr El Sheikh (كفر الشيخ) ── EG-KFS ────────────────────────────
            // Fixed: Metoubes → Matoubes
            [
                'name_en' => 'Kafr El Sheikh', 'name_ar' => 'كفر الشيخ', 'iso_code' => 'EG-KFS',
                'default_shipping_price' => 60.00, 'display_order' => 7,
                'cities' => [
                    ['name_en' => 'Kafr El Sheikh', 'name_ar' => 'كفر الشيخ'],
                    ['name_en' => 'Desouk',         'name_ar' => 'دسوق'],
                    ['name_en' => 'Biyala',         'name_ar' => 'بيلا'],
                    ['name_en' => 'Fowa',           'name_ar' => 'فوه'],
                    ['name_en' => 'Sidi Salem',     'name_ar' => 'سيدي سالم'],
                    ['name_en' => 'Matoubes',       'name_ar' => 'مطوبس'],
                    ['name_en' => 'El Hamoul',      'name_ar' => 'الحامول'],
                ],
            ],

            // ── Gharbia (الغربية) ── EG-GH ───────────────────────────────────────
            [
                'name_en' => 'Gharbia', 'name_ar' => 'الغربية', 'iso_code' => 'EG-GH',
                'default_shipping_price' => 55.00, 'display_order' => 8,
                'cities' => [
                    ['name_en' => 'Tanta',            'name_ar' => 'طنطا'],
                    ['name_en' => 'Mahalla El Kubra', 'name_ar' => 'المحلة الكبرى'],
                    ['name_en' => 'Kafr El Zayyat',   'name_ar' => 'كفر الزيات'],
                    ['name_en' => 'Samannoud',        'name_ar' => 'سمنود'],
                    ['name_en' => 'Zifta',            'name_ar' => 'زفتى'],
                    ['name_en' => 'Basyoun',          'name_ar' => 'بسيون'],
                    ['name_en' => 'Qutur',            'name_ar' => 'قطور'],
                ],
            ],

            // ── Monufia (المنوفية) ── EG-MNF ─────────────────────────────────────
            [
                'name_en' => 'Monufia', 'name_ar' => 'المنوفية', 'iso_code' => 'EG-MNF',
                'default_shipping_price' => 50.00, 'display_order' => 9,
                'cities' => [
                    ['name_en' => 'Shebin El Kom', 'name_ar' => 'شبين الكوم'],
                    ['name_en' => 'Menouf',        'name_ar' => 'منوف'],
                    ['name_en' => 'Sadat City',    'name_ar' => 'مدينة السادات'],
                    ['name_en' => 'Tala',          'name_ar' => 'تلا'],
                    ['name_en' => 'Ashmoun',       'name_ar' => 'أشمون'],
                    ['name_en' => 'El Shuhada',    'name_ar' => 'الشهداء'],
                    ['name_en' => 'Quesna',        'name_ar' => 'قويسنا'],
                    ['name_en' => 'Birket El Sab', 'name_ar' => 'بركة السبع'],
                ],
            ],

            // ── Beheira (البحيرة) ── EG-BH ───────────────────────────────────────
            // Receives: Rashid (Rosetta) moved from Alexandria → canonical "Rashid" already here.
            [
                'name_en' => 'Beheira', 'name_ar' => 'البحيرة', 'iso_code' => 'EG-BH',
                'default_shipping_price' => 55.00, 'display_order' => 10,
                'cities' => [
                    ['name_en' => 'Damanhur',       'name_ar' => 'دمنهور'],
                    ['name_en' => 'Kafr El Dawwar', 'name_ar' => 'كفر الدوار'],
                    ['name_en' => 'Itay El Barud',  'name_ar' => 'إيتاي البارود'],
                    ['name_en' => 'Rashid',         'name_ar' => 'رشيد'],
                    ['name_en' => 'Nubaria',        'name_ar' => 'النوبارية'],
                    ['name_en' => 'Abu El Matamir', 'name_ar' => 'أبو المطامير'],
                    ['name_en' => 'El Mahmoudiya',  'name_ar' => 'المحمودية'],
                    ['name_en' => 'Wadi El Natrun', 'name_ar' => 'وادي النطرون'],
                    ['name_en' => 'Hosh Issa',      'name_ar' => 'حوش عيسى'],
                ],
            ],

            // ── Ismailia (الإسماعيلية) ── EG-IS ──────────────────────────────────
            // Fixed: Ismailia City → Ismailia
            [
                'name_en' => 'Ismailia', 'name_ar' => 'الإسماعيلية', 'iso_code' => 'EG-IS',
                'default_shipping_price' => 50.00, 'display_order' => 11,
                'cities' => [
                    ['name_en' => 'Ismailia',         'name_ar' => 'الإسماعيلية'],
                    ['name_en' => 'Fayed',            'name_ar' => 'فايد'],
                    ['name_en' => 'El Qantara',       'name_ar' => 'القنطرة'],
                    ['name_en' => 'El Tel El Kabeer', 'name_ar' => 'التل الكبير'],
                    ['name_en' => 'Abu Soueir',       'name_ar' => 'أبو صوير'],
                ],
            ],

            // ── Suez (السويس) ── EG-SUZ ──────────────────────────────────────────
            // Fixed: Suez City → Suez
            [
                'name_en' => 'Suez', 'name_ar' => 'السويس', 'iso_code' => 'EG-SUZ',
                'default_shipping_price' => 55.00, 'display_order' => 12,
                'cities' => [
                    ['name_en' => 'Suez',          'name_ar' => 'السويس'],
                    ['name_en' => 'Attaka',        'name_ar' => 'عتاقة'],
                    ['name_en' => 'El Arbaeen',    'name_ar' => 'الأربعين'],
                    ['name_en' => 'Ain El Sokhna', 'name_ar' => 'العين السخنة'],
                ],
            ],

            // ── Port Said (بورسعيد) ── EG-PTS ────────────────────────────────────
            // Fixed: Port Said City → Port Said
            [
                'name_en' => 'Port Said', 'name_ar' => 'بورسعيد', 'iso_code' => 'EG-PTS',
                'default_shipping_price' => 55.00, 'display_order' => 13,
                'cities' => [
                    ['name_en' => 'Port Said',  'name_ar' => 'بورسعيد'],
                    ['name_en' => 'Port Fouad', 'name_ar' => 'بورفؤاد'],
                    ['name_en' => 'El Dawahy',  'name_ar' => 'الضواحي'],
                    ['name_en' => 'El Manakh',  'name_ar' => 'المناخ'],
                ],
            ],

            // ── Damietta (دمياط) ── EG-DT ────────────────────────────────────────
            // Fixed: Damietta City → Damietta
            [
                'name_en' => 'Damietta', 'name_ar' => 'دمياط', 'iso_code' => 'EG-DT',
                'default_shipping_price' => 55.00, 'display_order' => 14,
                'cities' => [
                    ['name_en' => 'Damietta',      'name_ar' => 'دمياط'],
                    ['name_en' => 'Ras El Bar',    'name_ar' => 'رأس البر'],
                    ['name_en' => 'Kafr El Batikh', 'name_ar' => 'كفر البطيخ'],
                    ['name_en' => 'El Zarqa',      'name_ar' => 'الزرقا'],
                    ['name_en' => 'Faraskur',      'name_ar' => 'فارسكور'],
                    ['name_en' => 'Kafr Saad',     'name_ar' => 'كفر سعد'],
                ],
            ],

            // ── Faiyum (الفيوم) ── EG-FYM ────────────────────────────────────────
            // Fixed: Faiyum City → Faiyum, Sinnuris → Sannuris
            [
                'name_en' => 'Faiyum', 'name_ar' => 'الفيوم', 'iso_code' => 'EG-FYM',
                'default_shipping_price' => 55.00, 'display_order' => 15,
                'cities' => [
                    ['name_en' => 'Faiyum',          'name_ar' => 'الفيوم'],
                    ['name_en' => 'Ibsheway',        'name_ar' => 'إبشواي'],
                    ['name_en' => 'Tamiya',          'name_ar' => 'طامية'],
                    ['name_en' => 'Yusuf El Seddik', 'name_ar' => 'يوسف الصديق'],
                    ['name_en' => 'Sannuris',        'name_ar' => 'سنورس'],
                    ['name_en' => 'Etsa',            'name_ar' => 'إطسا'],
                ],
            ],

            // ── Beni Suef (بني سويف) ── EG-BNS ──────────────────────────────────
            // Fixed: Beni Suef City → Beni Suef
            [
                'name_en' => 'Beni Suef', 'name_ar' => 'بني سويف', 'iso_code' => 'EG-BNS',
                'default_shipping_price' => 60.00, 'display_order' => 16,
                'cities' => [
                    ['name_en' => 'Beni Suef',       'name_ar' => 'بني سويف'],
                    ['name_en' => 'El Fashn',        'name_ar' => 'الفشن'],
                    ['name_en' => 'Ihnasiya',        'name_ar' => 'إهناسيا'],
                    ['name_en' => 'Nasser',          'name_ar' => 'ناصر'],
                    ['name_en' => 'Biba',            'name_ar' => 'ببا'],
                    ['name_en' => 'Sumusta El Waqf', 'name_ar' => 'سمسطا الوقف'],
                ],
            ],

            // ── Minya (المنيا) ── EG-MN ──────────────────────────────────────────
            // Fixed: Minya City → Minya
            [
                'name_en' => 'Minya', 'name_ar' => 'المنيا', 'iso_code' => 'EG-MN',
                'default_shipping_price' => 65.00, 'display_order' => 17,
                'cities' => [
                    ['name_en' => 'Minya',     'name_ar' => 'المنيا'],
                    ['name_en' => 'Mallawi',   'name_ar' => 'ملوي'],
                    ['name_en' => 'Samalut',   'name_ar' => 'سمالوط'],
                    ['name_en' => 'Maghagha',  'name_ar' => 'مغاغة'],
                    ['name_en' => 'Abu Qurqas', 'name_ar' => 'أبو قرقاص'],
                    ['name_en' => 'El Adwa',   'name_ar' => 'العدوة'],
                    ['name_en' => 'Matay',     'name_ar' => 'مطاي'],
                    ['name_en' => 'Beni Mazar', 'name_ar' => 'بني مزار'],
                ],
            ],

            // ── Asyut (أسيوط) ── EG-AST ──────────────────────────────────────────
            // Fixed: Asyut City → Asyut
            [
                'name_en' => 'Asyut', 'name_ar' => 'أسيوط', 'iso_code' => 'EG-AST',
                'default_shipping_price' => 70.00, 'display_order' => 18,
                'cities' => [
                    ['name_en' => 'Asyut',     'name_ar' => 'أسيوط'],
                    ['name_en' => 'Abnub',     'name_ar' => 'أبنوب'],
                    ['name_en' => 'Abu Tig',   'name_ar' => 'أبوتيج'],
                    ['name_en' => 'El Badari', 'name_ar' => 'البداري'],
                    ['name_en' => 'El Ghanaim', 'name_ar' => 'الغنايم'],
                    ['name_en' => 'El Fateh',  'name_ar' => 'الفتح'],
                    ['name_en' => 'Deirut',    'name_ar' => 'ديروط'],
                    ['name_en' => 'Sadfa',     'name_ar' => 'صدفا'],
                    ['name_en' => 'Manfalut',  'name_ar' => 'منفلوط'],
                    ['name_en' => 'El Qusiya', 'name_ar' => 'القوصية'],
                ],
            ],

            // ── Sohag (سوهاج) ── EG-SHG ──────────────────────────────────────────
            // Fixed: Sohag City → Sohag
            [
                'name_en' => 'Sohag', 'name_ar' => 'سوهاج', 'iso_code' => 'EG-SHG',
                'default_shipping_price' => 70.00, 'display_order' => 19,
                'cities' => [
                    ['name_en' => 'Sohag',       'name_ar' => 'سوهاج'],
                    ['name_en' => 'Girga',       'name_ar' => 'جرجا'],
                    ['name_en' => 'Akhmim',      'name_ar' => 'أخميم'],
                    ['name_en' => 'Tahta',       'name_ar' => 'طهطا'],
                    ['name_en' => 'Tema',        'name_ar' => 'طما'],
                    ['name_en' => 'El Maragha',  'name_ar' => 'المراغة'],
                    ['name_en' => 'Dar El Salam', 'name_ar' => 'دار السلام'],
                    ['name_en' => 'Sakultah',    'name_ar' => 'ساقلتة'],
                ],
            ],

            // ── Qena (قنا) ── EG-KN ──────────────────────────────────────────────
            // Fixed: Qena City → Qena
            [
                'name_en' => 'Qena', 'name_ar' => 'قنا', 'iso_code' => 'EG-KN',
                'default_shipping_price' => 75.00, 'display_order' => 20,
                'cities' => [
                    ['name_en' => 'Qena',        'name_ar' => 'قنا'],
                    ['name_en' => 'Nag Hammadi', 'name_ar' => 'نجع حمادي'],
                    ['name_en' => 'Dishna',      'name_ar' => 'دشنا'],
                    ['name_en' => 'Qift',        'name_ar' => 'قفط'],
                    ['name_en' => 'El Waqf',     'name_ar' => 'الوقف'],
                    ['name_en' => 'Abu Tesht',   'name_ar' => 'أبو تشت'],
                    ['name_en' => 'Farshout',    'name_ar' => 'فرشوط'],
                    ['name_en' => 'Naqada',      'name_ar' => 'نقادة'],
                ],
            ],

            // ── Luxor (الأقصر) ── EG-LX ──────────────────────────────────────────
            // Fixed: Luxor City → Luxor
            [
                'name_en' => 'Luxor', 'name_ar' => 'الأقصر', 'iso_code' => 'EG-LX',
                'default_shipping_price' => 80.00, 'display_order' => 21,
                'cities' => [
                    ['name_en' => 'Luxor',       'name_ar' => 'الأقصر'],
                    ['name_en' => 'Esna',        'name_ar' => 'إسنا'],
                    ['name_en' => 'Armant',      'name_ar' => 'الأرمنت'],
                    ['name_en' => 'El Qarna',    'name_ar' => 'القرنة'],
                    ['name_en' => 'El Zayniyya', 'name_ar' => 'الزينية'],
                ],
            ],

            // ── Aswan (أسوان) ── EG-ASN ──────────────────────────────────────────
            // Fixed: Aswan City → Aswan
            [
                'name_en' => 'Aswan', 'name_ar' => 'أسوان', 'iso_code' => 'EG-ASN',
                'default_shipping_price' => 90.00, 'display_order' => 22,
                'cities' => [
                    ['name_en' => 'Aswan',        'name_ar' => 'أسوان'],
                    ['name_en' => 'Edfu',         'name_ar' => 'إدفو'],
                    ['name_en' => 'Kom Ombo',     'name_ar' => 'كوم أمبو'],
                    ['name_en' => 'Daraw',        'name_ar' => 'دراو'],
                    ['name_en' => 'Abu Simbel',   'name_ar' => 'أبو سمبل'],
                    ['name_en' => 'Nasr El Nuba', 'name_ar' => 'نصر النوبة'],
                ],
            ],

            // ── Red Sea (البحر الأحمر) ── EG-BA ──────────────────────────────────
            [
                'name_en' => 'Red Sea', 'name_ar' => 'البحر الأحمر', 'iso_code' => 'EG-BA',
                'default_shipping_price' => 90.00, 'display_order' => 23,
                'cities' => [
                    ['name_en' => 'Hurghada',   'name_ar' => 'الغردقة'],
                    ['name_en' => 'Shalateen',  'name_ar' => 'الشلاتين'],
                    ['name_en' => 'Marsa Alam', 'name_ar' => 'مرسى علم'],
                    ['name_en' => 'Ras Gharib', 'name_ar' => 'رأس غارب'],
                    ['name_en' => 'El Quseir',  'name_ar' => 'القصير'],
                ],
            ],

            // ── New Valley (الوادي الجديد) ── EG-WAD ──────────────────────────────
            // Fixed: Paris (Baris) → Baris
            [
                'name_en' => 'New Valley', 'name_ar' => 'الوادي الجديد', 'iso_code' => 'EG-WAD',
                'default_shipping_price' => 100.00, 'display_order' => 24,
                'cities' => [
                    ['name_en' => 'Kharga Oasis',  'name_ar' => 'الخارجة'],
                    ['name_en' => 'Dakhla Oasis',  'name_ar' => 'الداخلة'],
                    ['name_en' => 'Farafra Oasis', 'name_ar' => 'الفرافرة'],
                    ['name_en' => 'Baris',         'name_ar' => 'بريس'],
                ],
            ],

            // ── Matrouh (مطروح) ── EG-MT ─────────────────────────────────────────
            [
                'name_en' => 'Matrouh', 'name_ar' => 'مطروح', 'iso_code' => 'EG-MT',
                'default_shipping_price' => 90.00, 'display_order' => 25,
                'cities' => [
                    ['name_en' => 'Marsa Matrouh', 'name_ar' => 'مرسى مطروح'],
                    ['name_en' => 'El Dabaa',      'name_ar' => 'الضبعة'],
                    ['name_en' => 'Sidi Barrani',  'name_ar' => 'سيدي براني'],
                    ['name_en' => 'Sollum',        'name_ar' => 'السلوم'],
                    ['name_en' => 'El Alamein',    'name_ar' => 'العلمين'],
                    ['name_en' => 'El Hammam',     'name_ar' => 'الحمام'],
                    ['name_en' => 'Siwa Oasis',    'name_ar' => 'واحة سيوة'],
                ],
            ],

            // ── North Sinai (شمال سيناء) ── EG-SIN ──────────────────────────────
            // Fixed: Arish City → El Arish (official transliteration)
            [
                'name_en' => 'North Sinai', 'name_ar' => 'شمال سيناء', 'iso_code' => 'EG-SIN',
                'default_shipping_price' => 85.00, 'display_order' => 26,
                'cities' => [
                    ['name_en' => 'El Arish',      'name_ar' => 'العريش'],
                    ['name_en' => 'Sheikh Zuweid', 'name_ar' => 'الشيخ زويد'],
                    ['name_en' => 'Bir El Abd',    'name_ar' => 'بئر العبد'],
                    ['name_en' => 'Nakhl',         'name_ar' => 'نخل'],
                    ['name_en' => 'El Hassana',    'name_ar' => 'الحسنة'],
                    ['name_en' => 'Rafah',         'name_ar' => 'رفح'],
                ],
            ],

            // ── South Sinai (جنوب سيناء) ── EG-JS ───────────────────────────────
            [
                'name_en' => 'South Sinai', 'name_ar' => 'جنوب سيناء', 'iso_code' => 'EG-JS',
                'default_shipping_price' => 90.00, 'display_order' => 27,
                'cities' => [
                    ['name_en' => 'El Tor',          'name_ar' => 'طور سيناء'],
                    ['name_en' => 'Sharm El Sheikh',  'name_ar' => 'شرم الشيخ'],
                    ['name_en' => 'Dahab',           'name_ar' => 'دهب'],
                    ['name_en' => 'Nuweiba',         'name_ar' => 'نويبع'],
                    ['name_en' => 'Taba',            'name_ar' => 'طابا'],
                    ['name_en' => 'Saint Catherine', 'name_ar' => 'سانت كاترين'],
                ],
            ],
        ];
    }
}
