import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

const STORAGE_KEY_COMPANY = 'ecos:activeCompanyId';
const STORAGE_KEY_BRAND = 'ecos:activeBrandId';
const STORAGE_KEY_WAREHOUSE = 'ecos:activeWarehouseId';

type OrgCtx = {
  activeCompanyId: string | null;
  setActiveCompanyId: (id: string | null) => void;
  activeBrandId: string | null;
  setActiveBrandId: (id: string | null) => void;
  activeWarehouseId: string | null;
  setActiveWarehouseId: (id: string | null) => void;
};

const OrgContext = createContext<OrgCtx | null>(null);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY_COMPANY),
  );
  const [activeBrandId, setActiveBrandIdState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY_BRAND),
  );
  const [activeWarehouseId, setActiveWarehouseIdState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY_WAREHOUSE),
  );

  const setActiveCompanyId = useCallback((id: string | null) => {
    setActiveCompanyIdState(id);
    if (id) localStorage.setItem(STORAGE_KEY_COMPANY, id);
    else localStorage.removeItem(STORAGE_KEY_COMPANY);
    // Clear brand and warehouse when company changes — they belong to a specific company
    setActiveBrandIdState(null);
    localStorage.removeItem(STORAGE_KEY_BRAND);
    setActiveWarehouseIdState(null);
    localStorage.removeItem(STORAGE_KEY_WAREHOUSE);
  }, []);

  const setActiveBrandId = useCallback((id: string | null) => {
    setActiveBrandIdState(id);
    if (id) localStorage.setItem(STORAGE_KEY_BRAND, id);
    else localStorage.removeItem(STORAGE_KEY_BRAND);
  }, []);

  const setActiveWarehouseId = useCallback((id: string | null) => {
    setActiveWarehouseIdState(id);
    if (id) localStorage.setItem(STORAGE_KEY_WAREHOUSE, id);
    else localStorage.removeItem(STORAGE_KEY_WAREHOUSE);
  }, []);

  const value = useMemo(
    () => ({
      activeCompanyId,
      setActiveCompanyId,
      activeBrandId,
      setActiveBrandId,
      activeWarehouseId,
      setActiveWarehouseId,
    }),
    [activeCompanyId, setActiveCompanyId, activeBrandId, setActiveBrandId, activeWarehouseId, setActiveWarehouseId],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrganizationContext() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrganizationContext must be inside OrganizationProvider');
  return ctx;
}
