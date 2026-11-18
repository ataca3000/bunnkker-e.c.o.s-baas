import type { Metadata } from 'next';
import EnterpriseConsoleView from '@/components/enterprise/EnterpriseConsoleView';

export const metadata: Metadata = {
  title: 'Consola Central Multi-Sucursal | BUNKKER E.C.O.S.',
  description:
    'Gobierno multi-sucursal, sesiones revocables, SSO corporativo, matriz RBAC, bitácora SHA-256 e integración Google Workspace.',
};

export default function EnterpriseConsolePage() {
  return <EnterpriseConsoleView />;
}
