import ExecutiveDashboardView from '@/components/dashboard/ExecutiveDashboardView';

export const metadata = {
  title: 'Tablero Ejecutivo | BUNKKER ERP',
  description:
    'Visualización ejecutiva de ventas diarias, semanales y mensuales con tarjetas de KPIs y crecimiento porcentual.',
};

export default function ExecutiveDashboardPage() {
  return <ExecutiveDashboardView />;
}
