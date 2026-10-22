import { flag } from 'flags/next'
import { vercelAdapter } from '@flags-sdk/vercel'

export const membershipCheckoutEnabled = flag<boolean>({
  key: 'membership-checkout-enabled',
  description: 'Permite iniciar nuevas suscripciones de membresía con Stripe.',
  defaultValue: true,
  options: [
    { value: true, label: 'Activo' },
    { value: false, label: 'Pausado' },
  ],
  adapter: vercelAdapter,
})

export const customerBillingPortalEnabled = flag<boolean>({
  key: 'customer-billing-portal-enabled',
  description: 'Muestra el portal de facturación de Stripe al cliente.',
  defaultValue: true,
  options: [
    { value: true, label: 'Activo' },
    { value: false, label: 'Oculto' },
  ],
  adapter: vercelAdapter,
})

export const membershipPlanVisibility = flag<'all' | 'local-hybrid' | 'enterprise-only'>({
  key: 'membership-plan-visibility',
  description: 'Controla qué planes de membresía se muestran al cliente.',
  defaultValue: 'all',
  options: [
    { value: 'all', label: 'Todos' },
    { value: 'local-hybrid', label: 'Local e Híbrido' },
    { value: 'enterprise-only', label: 'Enterprise' },
  ],
  adapter: vercelAdapter,
})
