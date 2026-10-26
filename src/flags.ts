import { flag } from 'flags/next'
import { vercelAdapter } from '@flags-sdk/vercel'

export const membershipCheckoutEnabled = flag<boolean>({
  key: 'membership-checkout-enabled',
  description: 'Permite iniciar nuevas suscripciones de membresía con Stripe.',
  defaultValue: false,
  options: [
    { value: true, label: 'Activo' },
    { value: false, label: 'Pausado' },
  ],
  adapter: vercelAdapter,
})

export const customerBillingPortalEnabled = flag<boolean>({
  key: 'customer-billing-portal-enabled',
  description: 'Muestra el portal de facturación de Stripe al cliente.',
  defaultValue: false,
  options: [
    { value: true, label: 'Activo' },
    { value: false, label: 'Oculto' },
  ],
  adapter: vercelAdapter,
})

export const membershipPlanVisibility = flag<'all' | 'monthly' | 'local' | 'enterprise'>({
  key: 'membership-plan-visibility',
  description: 'Controla los planes y la modalidad de cobro que se muestran al cliente.',
  defaultValue: 'all',
  options: [
    { value: 'all', label: 'Todos' },
    { value: 'monthly', label: 'Solo mensual' },
    { value: 'local', label: 'Local e híbrido' },
    { value: 'enterprise', label: 'Solo Enterprise' },
  ],
  adapter: vercelAdapter,
})
