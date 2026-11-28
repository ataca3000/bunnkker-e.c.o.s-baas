import type { Metadata } from 'next';
import EnterpriseConsoleView, {
  type ConsoleTab,
} from '@/components/enterprise/EnterpriseConsoleView';

export const metadata: Metadata = {
  title: 'Consola Central Multi-Sucursal | BUNKKER E.C.O.S.',
  description:
    'Gobierno multi-sucursal, sesiones revocables, SSO corporativo, matriz RBAC, bitácora SHA-256 e integración Google Workspace.',
};

const VALID_TABS = new Set<ConsoleTab>([
  'branches',
  'sessions',
  'rbac',
  'audit',
  'workspace',
  'hybrid-ai',
]);

export default async function EnterpriseConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const rawTab = sp?.tab as ConsoleTab | undefined;
  const initialTab: ConsoleTab = rawTab && VALID_TABS.has(rawTab) ? rawTab : 'branches';

  return <EnterpriseConsoleView initialTab={initialTab} />;
}
