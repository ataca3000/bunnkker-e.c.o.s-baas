// ── Egyptian Governorates Reference Data ──────────────────────────────────────
// All 27 governorates. Users pick from this list — never create free-text.

export type EgyptGovernorate = {
  name:   string;
  nameAr: string;
  code:   string;
};

export const EGYPT_GOVERNORATES: EgyptGovernorate[] = [
  // Greater Cairo Region
  { name: 'Cairo',        nameAr: 'القاهرة',        code: 'CAI' },
  { name: 'Giza',         nameAr: 'الجيزة',         code: 'GIZ' },
  { name: 'Qalyubia',     nameAr: 'القليوبية',      code: 'QAL' },
  // Alexandria Region
  { name: 'Alexandria',   nameAr: 'الإسكندرية',     code: 'ALX' },
  { name: 'Beheira',      nameAr: 'البحيرة',        code: 'BHR' },
  { name: 'Matruh',       nameAr: 'مطروح',          code: 'MAT' },
  // Nile Delta
  { name: 'Dakahlia',     nameAr: 'الدقهلية',       code: 'DAK' },
  { name: 'Sharqia',      nameAr: 'الشرقية',        code: 'SHA' },
  { name: 'Gharbia',      nameAr: 'الغربية',        code: 'GHR' },
  { name: 'Monufia',      nameAr: 'المنوفية',       code: 'MON' },
  { name: 'Kafr El-Sheikh', nameAr: 'كفر الشيخ',   code: 'KFS' },
  { name: 'Damietta',     nameAr: 'دمياط',          code: 'DAM' },
  // Canal Zone
  { name: 'Port Said',    nameAr: 'بورسعيد',        code: 'PRT' },
  { name: 'Ismailia',     nameAr: 'الإسماعيلية',    code: 'ISM' },
  { name: 'Suez',         nameAr: 'السويس',         code: 'SUZ' },
  // Upper Egypt (North)
  { name: 'Faiyum',       nameAr: 'الفيوم',         code: 'FAI' },
  { name: 'Beni Suef',    nameAr: 'بني سويف',       code: 'BNS' },
  { name: 'Minya',        nameAr: 'المنيا',         code: 'MIN' },
  // Upper Egypt (South)
  { name: 'Asyut',        nameAr: 'أسيوط',          code: 'ASY' },
  { name: 'Sohag',        nameAr: 'سوهاج',          code: 'SOH' },
  { name: 'Qena',         nameAr: 'قنا',            code: 'QNA' },
  { name: 'Luxor',        nameAr: 'الأقصر',         code: 'LUX' },
  { name: 'Aswan',        nameAr: 'أسوان',          code: 'ASW' },
  // Remote/Border
  { name: 'Red Sea',      nameAr: 'البحر الأحمر',   code: 'RED' },
  { name: 'New Valley',   nameAr: 'الوادي الجديد',  code: 'NVL' },
  { name: 'North Sinai',  nameAr: 'شمال سيناء',     code: 'NSI' },
  { name: 'South Sinai',  nameAr: 'جنوب سيناء',     code: 'SSI' },
];

// ── Egypt Default Operational Delivery Zones ──────────────────────────────────
// Pre-defined operational zones for bulk import.
// These represent common business delivery areas, not administrative districts.

export type EgyptDefaultZones = {
  governorate: string;
  zones:       string[];
};

export const EGYPT_DEFAULT_ZONES: EgyptDefaultZones[] = [
  {
    governorate: 'Cairo',
    zones: [
      'Nasr City',
      'Maadi',
      'Heliopolis',
      'Mokattam',
      'New Cairo',
      'El Nozha',
      'Shorouk',
      'Obour',
      'El Rehab',
      'Badr City',
      'Zaytoun',
      'Shubra',
      'Ain Shams',
    ],
  },
  {
    governorate: 'Giza',
    zones: [
      'Dokki',
      'Mohandessin',
      'Haram',
      'Faisal',
      '6th October',
      'Sheikh Zayed',
      'Agouza',
      'Imbaba',
      'Hadaiq Al Ahram',
      'Bulaq Al Dakrour',
    ],
  },
  {
    governorate: 'Alexandria',
    zones: [
      'Smouha',
      'Sidi Gaber',
      'Miami',
      'Mandara',
      'Agami',
      'Gleem',
      'San Stefano',
      'Sidi Bishr',
      'Montazah',
      'Stanley',
      'Kafr Abdo',
    ],
  },
  {
    governorate: 'Dakahlia',
    zones: ['Mansoura', 'Talkha', 'Mit Ghamr', 'Aga', 'Sherbin'],
  },
  {
    governorate: 'Sharqia',
    zones: ['Zagazig', '10th of Ramadan', 'Bilbeis', 'Minya El Qamh'],
  },
  {
    governorate: 'Beheira',
    zones: ['Damanhour', 'Kafr El Dawwar', 'Hosh Issa', 'Abu Qir'],
  },
  {
    governorate: 'Monufia',
    zones: ['Shibin El Kom', 'Menouf', 'Quesna', 'Berket El Sab'],
  },
  {
    governorate: 'Qalyubia',
    zones: ['Benha', 'Qalyub', 'Khanka', 'Shoubra El Kheima'],
  },
  {
    governorate: 'Gharbia',
    zones: ['Tanta', 'Mahalla El Kubra', 'Kafr El Zayat', 'Zefta'],
  },
  {
    governorate: 'Port Said',
    zones: ['Port Said City', 'Port Fouad'],
  },
  {
    governorate: 'Ismailia',
    zones: ['Ismailia City', 'Fayid', 'Abu Sultan', 'Tel El Kebir'],
  },
  {
    governorate: 'Suez',
    zones: ['Suez City', 'El Arbaeen', 'El Ganayen'],
  },
  {
    governorate: 'Damietta',
    zones: ['Damietta City', 'New Damietta', 'Ras El Bar'],
  },
  {
    governorate: 'Faiyum',
    zones: ['Fayoum City', 'Sinnuris', 'Tamiya'],
  },
  {
    governorate: 'Beni Suef',
    zones: ['Beni Suef City', 'El Wasta', 'Nasser'],
  },
  {
    governorate: 'Minya',
    zones: ['Minya City', 'Abu Qurqas', 'Mallawi'],
  },
  {
    governorate: 'Asyut',
    zones: ['Asyut City', 'Dairut', 'Manfalut'],
  },
  {
    governorate: 'Sohag',
    zones: ['Sohag City', 'Akhmim', 'Tahta', 'Girga'],
  },
  {
    governorate: 'Qena',
    zones: ['Qena City', 'Nag Hammadi', 'Dishna'],
  },
  {
    governorate: 'Luxor',
    zones: ['Luxor City', 'Luxor East Bank', 'Luxor West Bank'],
  },
  {
    governorate: 'Aswan',
    zones: ['Aswan City', 'Kom Ombo', 'Edfu'],
  },
];
