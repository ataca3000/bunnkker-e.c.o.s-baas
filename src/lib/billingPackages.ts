export interface TimbrePackage {
  id: 'pack-100' | 'pack-200';
  name: string;
  timbres: number;
  priceMxn: number;
  unitPriceMxn: number;
  recommended?: boolean;
  badgeText: string;
}

export const TIMBRE_UNIT_PRICE_MXN = 3;

export const BILLING_TIMBRE_PACKAGES: TimbrePackage[] = [
  {
    id: 'pack-100',
    name: 'Recarga 100 Timbres',
    timbres: 100,
    priceMxn: 300,
    unitPriceMxn: TIMBRE_UNIT_PRICE_MXN,
    badgeText: '100 × $300 MXN',
  },
  {
    id: 'pack-200',
    name: 'Recarga 200 Timbres',
    timbres: 200,
    priceMxn: 600,
    unitPriceMxn: TIMBRE_UNIT_PRICE_MXN,
    recommended: true,
    badgeText: '200 × $600 MXN',
  },
];
