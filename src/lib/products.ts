export type SubscriptionPlan = {
  id: 'local' | 'hybrid' | 'enterprise'
  name: string
  description: string
  monthlyPriceId?: string
  annualPriceId?: string
  limits: string[]
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'local',
    name: 'Local',
    description: 'Operación POS en Wi‑Fi LAN con bridge local.',
    monthlyPriceId: process.env.STRIPE_MONTHLY_PRICE_ID,
    annualPriceId: process.env.STRIPE_ANNUAL_PRICE_ID,
    limits: ['1 sucursal', 'Hasta 3 roles operativos', 'Radio LAN en puerto 3002'],
  },
  {
    id: 'hybrid',
    name: 'Híbrido',
    description: 'Continuidad local con respaldo y operación cloud.',
    monthlyPriceId: process.env.STRIPE_MONTHLY_PRICE_ID_2,
    annualPriceId: process.env.STRIPE_ANNUAL_PRICE_ID_2,
    limits: ['Hasta 5 roles', 'Sincronización local-cloud', 'Reportes y facturación'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Multi-sucursal, soporte y despliegue personalizado.',
    limits: ['Roles ilimitados', 'Multi-tenant', 'Arquitectura y soporte dedicado'],
  },
]

export function getConfiguredPriceIds() {
  return SUBSCRIPTION_PLANS.flatMap((plan) => [plan.monthlyPriceId, plan.annualPriceId]).filter(
    (id): id is string => Boolean(id && /^price_[A-Za-z0-9]+$/.test(id)),
  )
}

export function isConfiguredPriceId(priceId: unknown): priceId is string {
  return typeof priceId === 'string' && getConfiguredPriceIds().includes(priceId)
}
