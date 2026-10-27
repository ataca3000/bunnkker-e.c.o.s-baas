export type SubscriptionPlanId = 'free_starter' | 'starter' | 'pro' | 'terminal_addon' | 'enterprise' | 'local' | 'hybrid';

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  name: string;
  subtitle?: string;
  description: string;
  monthlyPriceId?: string;
  annualPriceId?: string;
  priceMonthly: number;
  priceAnnual?: number;
  maxMachines: number;
  usersPerRole: number;
  popular?: boolean;
  limits: string[];
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free_starter',
    name: 'Emprendedor (1 Terminal / Móvil)',
    subtitle: '$0 MXN / Para Siempre',
    description: 'Acompañamiento inicial para nuevos emprendedores: 1 usuario en caja o móvil, catálogo y cobro 100% offline.',
    priceMonthly: 0,
    priceAnnual: 0,
    maxMachines: 1,
    usersPerRole: 1,
    popular: false,
    limits: [
      '1 Terminal o Celular vinculado (HWID)',
      '1 Usuario (Dueño con lógica simplificada)',
      'Catálogo de productos 100% offline',
      'Arqueo de caja y cobro con tickets',
      'Cero tarjetas ni costos ocultos',
    ],
  },
  {
    id: 'starter',
    name: 'Starter (3 Terminales)',
    subtitle: '$499 MXN / mes',
    description: '1 Sucursal: ideal para 1 caja principal, 1 tablet en patio/almacén y 1 laptop administrativa.',
    priceMonthly: 499,
    priceAnnual: 4990,
    maxMachines: 3,
    usersPerRole: 2,
    popular: false,
    monthlyPriceId: process.env.STRIPE_MONTHLY_PRICE_STARTER || process.env.STRIPE_MONTHLY_PRICE_ID,
    annualPriceId: process.env.STRIPE_ANNUAL_PRICE_STARTER || process.env.STRIPE_ANNUAL_PRICE_ID,
    limits: [
      'Hasta 3 máquinas vinculadas (HWID)',
      'Hasta 2 usuarios por rol operativo',
      'Clientes y Catálogo 100% Ilimitados',
      'Operación 100% Offline Resiliente',
      'Sincronización Wi-Fi LAN P2P / Radio local',
      'Impresión térmica de tickets y comandas',
    ],
  },
  {
    id: 'pro',
    name: 'Pro (6 Terminales)',
    subtitle: '$999 MXN / mes',
    description: 'Para comercios en expansión con alto flujo, patio de maniobras, almacén y reparto activo.',
    priceMonthly: 999,
    priceAnnual: 9990,
    maxMachines: 6,
    usersPerRole: 5,
    popular: true,
    monthlyPriceId: process.env.STRIPE_MONTHLY_PRICE_PRO || process.env.STRIPE_MONTHLY_PRICE_ID_2,
    annualPriceId: process.env.STRIPE_ANNUAL_PRICE_PRO || process.env.STRIPE_ANNUAL_PRICE_ID_2,
    limits: [
      'Hasta 6 máquinas vinculadas (HWID)',
      'Hasta 5 usuarios por rol operativo',
      'Clientes y Catálogo 100% Ilimitados',
      'Sincronización Cloud BaaS automática',
      'Facturación Electrónica SAT CFDI 4.0',
      'Respaldos automáticos diarios inmutables',
      'Soporte técnico prioritario',
    ],
  },
  {
    id: 'terminal_addon',
    name: 'Terminal Adicional (+1)',
    subtitle: '$199 MXN / mes',
    description: 'Añade una máquina o caja extra a tu paquete activo sin saltar de nivel tarifario.',
    priceMonthly: 199,
    priceAnnual: 1990,
    maxMachines: 1,
    usersPerRole: 1,
    popular: false,
    monthlyPriceId: process.env.STRIPE_PRICE_TERMINAL_ADDON,
    annualPriceId: process.env.STRIPE_ANNUAL_PRICE_TERMINAL_ADDON,
    limits: [
      '+1 Máquina / Terminal vinculada',
      '+1 Usuario operativo adicional',
      'Activación instantánea por NIP / QR',
      'Sincronización automática a la red LAN',
    ],
  },
  {
    id: 'enterprise',
    name: 'Combo Super Power (Monitoreo Global)',
    subtitle: 'Nivel Business',
    description: 'Despliegue dedicado en la Nube con Monitoreo Global en tiempo real desde China o cualquier parte del mundo con internet, agentes de administración y multi-sucursal.',
    priceMonthly: 2499,
    priceAnnual: 24990,
    maxMachines: 999,
    usersPerRole: 999,
    popular: false,
    monthlyPriceId: process.env.STRIPE_PRICE_ENTERPRISE,
    annualPriceId: process.env.STRIPE_ANNUAL_PRICE_ENTERPRISE,
    limits: [
      'Monitoreo remoto en tiempo real (desde China o cualquier país)',
      'Agentes de administración y auditoría continua',
      'Máquinas y terminales ilimitadas',
      'Roles con interruptores de habilidad para el dueño',
      'Multi-tenant con Red B2B Colmena',
      'Base de datos SQLite WAL + Réplica Cloud',
      'SLA garantizado 99.9% y soporte prioritario',
    ],
  },
];

export function getConfiguredPriceIds() {
  const fromPlans = SUBSCRIPTION_PLANS.flatMap((plan) => [plan.monthlyPriceId, plan.annualPriceId]);
  const envPrices = [
    process.env.STRIPE_MONTHLY_PRICE_ID,
    process.env.STRIPE_ANNUAL_PRICE_ID,
    process.env.STRIPE_MONTHLY_PRICE_ID_2,
    process.env.STRIPE_ANNUAL_PRICE_ID_2,
    process.env.STRIPE_MONTHLY_PRICE_STARTER,
    process.env.STRIPE_ANNUAL_PRICE_STARTER,
    process.env.STRIPE_MONTHLY_PRICE_PRO,
    process.env.STRIPE_ANNUAL_PRICE_PRO,
    process.env.STRIPE_PRICE_TERMINAL_ADDON,
    process.env.STRIPE_ANNUAL_PRICE_TERMINAL_ADDON,
    process.env.STRIPE_PRICE_ENTERPRISE,
    process.env.STRIPE_ANNUAL_PRICE_ENTERPRISE,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_LOCAL,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_HYBRID,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_P2P,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_TERMINAL_ADDON,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE,
  ];

  return Array.from(new Set([...fromPlans, ...envPrices])).filter(
    (id): id is string => Boolean(id && /^price_[A-Za-z0-9]+$/.test(id)),
  );
}

export function isConfiguredPriceId(priceId: unknown): priceId is string {
  return typeof priceId === 'string' && getConfiguredPriceIds().includes(priceId);
}

