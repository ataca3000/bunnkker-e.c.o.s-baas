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

// ─── Banderas de Vercel: Acompañamiento y Crecimiento de Emprendedores ───────

export const freeTierEnabled = flag<boolean>({
  key: 'free-tier-enabled',
  description: 'Nivel 1 Gratis: Permite a un emprendedor operar 100% gratis en 1 máquina / terminal móvil con catálogo local.',
  defaultValue: true,
  options: [
    { value: true, label: 'Activo (Gratis 1 Máquina / Móvil)' },
    { value: false, label: 'Desactivado' },
  ],
  adapter: vercelAdapter,
})

export const roleCapabilitySwitchesEnabled = flag<boolean>({
  key: 'role-capability-switches-enabled',
  description: 'Permite al dueño activar/desactivar habilidades (repartidor, almacén, pickup, carga) en su propio usuario con lógica simplificada.',
  defaultValue: true,
  options: [
    { value: true, label: 'Habilitado' },
    { value: false, label: 'Deshabilitado' },
  ],
  adapter: vercelAdapter,
})

export const enterpriseRemoteMonitoringEnabled = flag<boolean>({
  key: 'enterprise-remote-monitoring-enabled',
  description: 'Nivel Enterprise: Despliegue personalizado que permite monitoreo global en tiempo real desde China o cualquier parte del mundo.',
  defaultValue: true,
  options: [
    { value: true, label: 'Monitoreo Global Activo' },
    { value: false, label: 'Solo Local' },
  ],
  adapter: vercelAdapter,
})

